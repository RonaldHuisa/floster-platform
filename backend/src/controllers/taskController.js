const pool = require("../config/db");

function getAuthUserId(req) {
    return req.user.userId || req.user.id;
}

async function getCurrentTaskPeriod(client) {
    const result = await client.query(`
        WITH lima_time AS (
            SELECT 
                NOW() AS server_now,
                NOW() AT TIME ZONE 'America/Lima' AS now_lima
        ),
        reset_calc AS (
            SELECT
                server_now,
                now_lima,
                (now_lima::date + TIME '09:00') AS today_reset_lima
            FROM lima_time
        ),
        period_calc AS (
            SELECT
                server_now,
                CASE
                    WHEN now_lima >= today_reset_lima
                    THEN today_reset_lima
                    ELSE today_reset_lima - INTERVAL '1 day'
                END AS period_start_lima,
                CASE
                    WHEN now_lima >= today_reset_lima
                    THEN today_reset_lima + INTERVAL '1 day'
                    ELSE today_reset_lima
                END AS period_end_lima
            FROM reset_calc
        )
        SELECT
            period_start_lima AT TIME ZONE 'America/Lima' AS period_start,
            period_end_lima AT TIME ZONE 'America/Lima' AS period_end,
            server_now
        FROM period_calc
    `);

    return result.rows[0];
}

async function getTasksDashboard(req, res) {
    const userId = getAuthUserId(req);

    const client = await pool.connect();

    try {
        const period = await getCurrentTaskPeriod(client);

        const userResult = await client.query(
            `
            SELECT 
                id,
                email,
                COALESCE(balance_usdt, 0) AS balance_usdt,
                COALESCE(withdrawable_usdt, 0) AS withdrawable_usdt
            FROM users
            WHERE id = $1
            `,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                message: "Usuario no encontrado.",
            });
        }

        const tasksResult = await client.query(
            `
            SELECT
                vp.id AS vip_purchase_id,
                vp.level AS vip_level,
                vp.daily_income_usdt AS reward_usdt,
                vp.expires_at,
                vdt.id AS task_id,
                vdt.completed_at,
                CASE
                    WHEN vdt.id IS NULL THEN 'pending'
                    ELSE 'completed'
                END AS task_status
            FROM vip_purchases vp
            LEFT JOIN vip_daily_tasks vdt
                ON vdt.vip_purchase_id = vp.id
                AND vdt.user_id = vp.user_id
                AND vdt.period_start = $2
            WHERE vp.user_id = $1
              AND vp.status = 'active'
              AND vp.expires_at > NOW()
            ORDER BY vp.level ASC, vp.id ASC
            `,
            [userId, period.period_start]
        );

        const tasks = tasksResult.rows.map((task) => ({
            vipPurchaseId: task.vip_purchase_id,
            vipLevel: Number(task.vip_level),
            rewardUsdt: task.reward_usdt,
            expiresAt: task.expires_at,
            taskId: task.task_id,
            completedAt: task.completed_at,
            status: task.task_status,
        }));

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((task) => task.status === "completed").length;
        const pendingTasks = tasks.filter((task) => task.status === "pending").length;

        return res.json({
            user: userResult.rows[0],
            withdrawableBalanceUsdt: userResult.rows[0].withdrawable_usdt,
            periodStart: period.period_start,
            nextResetAt: period.period_end,
            serverNow: period.server_now,
            totalTasks,
            completedTasks,
            pendingTasks,
            tasks,
        });
    } catch (error) {
        console.error("GET TASKS DASHBOARD ERROR:", error);

        return res.status(500).json({
            message: "Error al cargar tareas.",
            detail: error.message,
        });
    } finally {
        client.release();
    }
}

async function completeVipTask(req, res) {
    const userId = getAuthUserId(req);
    const { vipPurchaseId } = req.params;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const period = await getCurrentTaskPeriod(client);

        const vipResult = await client.query(
            `
            SELECT 
                id,
                user_id,
                level,
                daily_income_usdt,
                expires_at,
                status
            FROM vip_purchases
            WHERE id = $1
              AND user_id = $2
            FOR UPDATE
            `,
            [vipPurchaseId, userId]
        );

        if (vipResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "VIP no encontrado.",
            });
        }

        const vip = vipResult.rows[0];

        if (vip.status !== "active" || new Date(vip.expires_at) <= new Date()) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Este VIP no está activo.",
            });
        }

        const taskResult = await client.query(
            `
            INSERT INTO vip_daily_tasks
            (
                user_id,
                vip_purchase_id,
                vip_level,
                period_start,
                period_end,
                reward_usdt,
                status,
                completed_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'completed', NOW())
            ON CONFLICT (user_id, vip_purchase_id, period_start)
            DO NOTHING
            RETURNING id, reward_usdt
            `,
            [
                userId,
                vip.id,
                vip.level,
                period.period_start,
                period.period_end,
                vip.daily_income_usdt,
            ]
        );

        if (taskResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                message: "Esta tarea ya fue completada. Espera el próximo reinicio.",
            });
        }

        const task = taskResult.rows[0];

        await client.query(
            `
            UPDATE users
            SET withdrawable_usdt = COALESCE(withdrawable_usdt, 0) + $1
            WHERE id = $2
            `,
            [task.reward_usdt, userId]
        );

        await client.query(
            `
            INSERT INTO account_ledger
            (
                user_id,
                balance_type,
                direction,
                type,
                title,
                amount_usdt,
                description,
                reference_type,
                reference_id,
                metadata,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::json, $11)
            ON CONFLICT DO NOTHING
            `,
            [
                userId,
                "earnings",
                "credit",
                "task_income",
                `Ganancia de tarea VIP${vip.level}`,
                task.reward_usdt,
                `Ganancia diaria por completar tarea de VIP${vip.level}.`,
                "vip_daily_task",
                task.id,
                JSON.stringify({
                    vipPurchaseId: vip.id,
                    vipLevel: vip.level,
                    periodStart: period.period_start,
                    periodEnd: period.period_end,
                }),
                "completed",
            ]
        );

        await client.query("COMMIT");

        return res.json({
            message: `Tarea completada. Ganaste ${Number(task.reward_usdt).toFixed(2)} USDT.`,
            rewardUsdt: task.reward_usdt,
            nextResetAt: period.period_end,
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("COMPLETE VIP TASK ERROR:", error);

        return res.status(500).json({
            message: "Error al completar tarea.",
            detail: error.message,
        });
    } finally {
        client.release();
    }
}

module.exports = {
    getTasksDashboard,
    completeVipTask,
};
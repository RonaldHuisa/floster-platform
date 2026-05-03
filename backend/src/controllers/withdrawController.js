const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const WITHDRAW_FEE_PERCENT = 8;
const MIN_WITHDRAW_USDT = 1;

function isValidBep20Address(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function toNumber(value) {
    return Number(value || 0);
}

async function getCurrentWithdrawPeriod(client) {
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




async function getWithdrawInfo(req, res) {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `
      SELECT id, withdrawable_usdt, withdrawal_address_bep20
      FROM users
      WHERE id = $1
      `,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Usuario no encontrado.",
            });
        }

        const user = result.rows[0];

        return res.json({
            available: user.withdrawable_usdt || "0",
            network: "BEP20-USDT",
            feePercent: WITHDRAW_FEE_PERCENT,
            minWithdraw: MIN_WITHDRAW_USDT,
            withdrawalAddress: user.withdrawal_address_bep20,
            addressLocked: Boolean(user.withdrawal_address_bep20),
        });
    } catch (error) {
        console.error("GET WITHDRAW INFO ERROR:", error);
        return res.status(500).json({
            message: "Error al obtener información de retiro.",
        });
    }
}

async function createWithdrawRequest(req, res) {
    const userId = req.user.userId;
    const { withdrawalAddress, amount, securityPassword } = req.body;

    const client = await pool.connect();

    try {
        if (!withdrawalAddress || !amount || !securityPassword) {
            return res.status(400).json({
                message: "Dirección, monto y contraseña de seguridad son obligatorios.",
            });
        }

        if (!isValidBep20Address(withdrawalAddress)) {
            return res.status(400).json({
                message: "La dirección de retiro BEP20 no es válida.",
            });
        }

        const amountNumber = toNumber(amount);

        if (amountNumber < MIN_WITHDRAW_USDT) {
            return res.status(400).json({
                message: `El monto mínimo de retiro es ${MIN_WITHDRAW_USDT} USDT.`,
            });
        }

        await client.query("BEGIN");

        const period = await getCurrentWithdrawPeriod(client);

        const existingWithdrawalResult = await client.query(
            `
            SELECT id, status, created_at
            FROM withdrawals
            WHERE user_id = $1
                AND created_at >= $2
                AND created_at < $3
                AND status IN ('pending', 'approved', 'paid')
            LIMIT 1
            `,
            [userId, period.period_start, period.period_end]
        );

        if (existingWithdrawalResult.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Solo puedes realizar un retiro por reinicio diario.",
                nextResetAt: period.period_end,
            });
        }



        const userResult = await client.query(
            `
            SELECT 
                id, 
                password_hash AS password,
                withdrawable_usdt, 
                withdrawal_address_bep20
            FROM users
            WHERE id = $1
            FOR UPDATE
            `,
            [userId]
        );

        if (userResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                message: "Usuario no encontrado.",
            });
        }

        const user = userResult.rows[0];

        const passwordOk = await bcrypt.compare(securityPassword, user.password);

        if (!passwordOk) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: "Contraseña de seguridad incorrecta.",
            });
        }

        const available = toNumber(user.withdrawable_usdt);

        if (amountNumber > available) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: "Saldo disponible insuficiente.",
            });
        }

        const savedAddress = user.withdrawal_address_bep20;

        if (
            savedAddress &&
            savedAddress.toLowerCase() !== withdrawalAddress.toLowerCase()
        ) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: "La dirección de retiro ya fue fijada y no puede cambiarse.",
            });
        }

        const feeAmount = amountNumber * (WITHDRAW_FEE_PERCENT / 100);
        const amountToReceive = amountNumber - feeAmount;

        if (!savedAddress) {
            await client.query(
                `
        UPDATE users
        SET withdrawal_address_bep20 = $1
        WHERE id = $2
        `,
                [withdrawalAddress, userId]
            );
        }

        const withdrawalResult = await client.query(
            `
                INSERT INTO withdrawals
                (
                    user_id,
                    network,
                    withdrawal_address,
                    amount_requested,
                    fee_percent,
                    fee_amount,
                    amount_to_receive,
                    status
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING *
                `,
            [
                userId,
                "BEP20-USDT",
                withdrawalAddress,
                amountNumber,
                WITHDRAW_FEE_PERCENT,
                feeAmount,
                amountToReceive,
                "pending",
            ]
        );

        await client.query(
            `
            UPDATE users
            SET withdrawable_usdt = COALESCE(withdrawable_usdt, 0) - $1
            WHERE id = $2
            `,
            [amountNumber, userId]
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
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
            `,
            [
                userId,
                "withdrawable",
                "debit",
                "withdrawal_request",
                "Deducción por retiro",
                -amountNumber,
                `Solicitud de retiro creada por ${amountNumber} USDT.`,
                "withdrawal",
                withdrawalResult.rows[0].id,
                JSON.stringify({
                    withdrawal_id: withdrawalResult.rows[0].id,
                    withdrawal_address: withdrawalAddress,
                    network: "BEP20-USDT",
                    amount_requested: amountNumber,
                    fee_percent: WITHDRAW_FEE_PERCENT,
                    fee_amount: feeAmount,
                    amount_to_receive: amountToReceive,
                }),
                "pending",
            ]
        );

        const newBalanceResult = await client.query(
            `
      SELECT withdrawable_usdt, withdrawal_address_bep20
      FROM users
      WHERE id = $1
      `,
            [userId]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            message: "Solicitud de retiro creada correctamente.",
            withdrawal: withdrawalResult.rows[0],
            currentWithdrawable: newBalanceResult.rows[0].withdrawable_usdt,
            withdrawalAddress: newBalanceResult.rows[0].withdrawal_address_bep20,
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("CREATE WITHDRAW ERROR:", error);

        return res.status(500).json({
            message: "Error al crear solicitud de retiro.",
        });
    } finally {
        client.release();
    }
}

async function getMyTransactions(req, res) {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            `
            SELECT 
            id,
            type,
            title,
            amount_usdt,
            balance_type,
            direction,
            metadata,
            status,
            created_at
            FROM account_ledger
            WHERE user_id = $1
             AND type NOT IN ('withdrawal_paid', 'vip_purchase')
            ORDER BY created_at DESC
            LIMIT 100;
                    `,
            [userId]
        );

        return res.json({
            transactions: result.rows,
        });
    } catch (error) {
        console.error("GET TRANSACTIONS ERROR:", error);

        return res.status(500).json({
            message: "Error al obtener historial.",
        });
    }
}

module.exports = {
    getWithdrawInfo,
    createWithdrawRequest,
    getMyTransactions,
};
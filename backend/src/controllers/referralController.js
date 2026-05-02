const pool = require("../config/db");

function maskEmail(email) {
    if (!email || !email.includes("@")) return "********";

    const [name, domain] = email.split("@");

    if (name.length <= 2) {
        return `${name[0]}***@${domain}`;
    }

    return `${name.slice(0, 2)}${"*".repeat(8)}@${domain}`;
}

function getBaseFrontendUrl() {
    return process.env.FRONTEND_URL || "http://localhost:3000";
}

async function getPromotionDashboard(req, res) {
    try {
        const userId = req.user.userId;

        const userResult = await pool.query(
            `
      SELECT id, email, referral_code
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

        const user = userResult.rows[0];

        const teamResult = await pool.query(
            `
      WITH RECURSIVE team AS (
        SELECT 
          u.id,
          u.email,
          u.created_at,
          u.vip_level,
          1 AS level
        FROM users u
        WHERE u.referred_by_id = $1

        UNION ALL

        SELECT 
          child.id,
          child.email,
          child.created_at,
          child.vip_level,
          team.level + 1 AS level
        FROM users child
        INNER JOIN team ON child.referred_by_id = team.id
        WHERE team.level < 3
      ),
      team_with_recharge AS (
        SELECT
          team.id,
          team.level,
          team.created_at,
          team.vip_level,
          COALESCE((
            SELECT SUM(d.amount_usdt)
            FROM deposits d
            WHERE d.user_id = team.id
            AND d.status = 'confirmed'
          ), 0) AS recharge_amount
        FROM team
      )
      SELECT
        level,
        COUNT(*) AS total_members,
        COUNT(*) FILTER (WHERE vip_level > 0) AS active_members,
        COALESCE(SUM(recharge_amount), 0) AS team_recharge
      FROM team_with_recharge
      GROUP BY level
      ORDER BY level
      `,
            [userId]
        );

        const commissionsResult = await pool.query(
            `
      SELECT
        level,
        COALESCE(SUM(amount_usdt), 0) AS total_commission,
        COALESCE(SUM(amount_usdt) FILTER (
          WHERE created_at::date = CURRENT_DATE
        ), 0) AS today_commission
      FROM referral_commissions
      WHERE receiver_user_id = $1
      GROUP BY level
      ORDER BY level
      `,
            [userId]
        );

        const totalIncomeResult = await pool.query(
            `
      SELECT
        COALESCE(SUM(amount_usdt), 0) AS total_income,
        COALESCE(SUM(amount_usdt) FILTER (
          WHERE created_at::date = CURRENT_DATE
        ), 0) AS today_income
      FROM referral_commissions
      WHERE receiver_user_id = $1
      `,
            [userId]
        );

        const todayAddedResult = await pool.query(
            `
      SELECT COUNT(*) AS today_added
      FROM users
      WHERE referred_by_id = $1
      AND created_at::date = CURRENT_DATE
      `,
            [userId]
        );

        const levels = [1, 2, 3].map((level) => {
            const team = teamResult.rows.find((item) => Number(item.level) === level);
            const commission = commissionsResult.rows.find(
                (item) => Number(item.level) === level
            );

            return {
                level,
                totalMembers: Number(team?.total_members || 0),
                activeMembers: Number(team?.active_members || 0),
                teamRecharge: Number(team?.team_recharge || 0),
                totalCommission: Number(commission?.total_commission || 0),
                todayCommission: Number(commission?.today_commission || 0),
            };
        });

        const totalMembers = levels.reduce(
            (sum, item) => sum + item.totalMembers,
            0
        );

        const totalTeamRecharge = levels.reduce(
            (sum, item) => sum + item.teamRecharge,
            0
        );

        return res.json({
            referralCode: user.referral_code,
            referralLink: `${getBaseFrontendUrl()}/register?ref=${user.referral_code}`,
            totalIncome: totalIncomeResult.rows[0]?.total_income || "0",
            todayIncome: totalIncomeResult.rows[0]?.today_income || "0",
            todayAdded: Number(todayAddedResult.rows[0]?.today_added || 0),
            totalMembers,
            totalTeamRecharge,
            levels,
        });
    } catch (error) {
        console.error("GET PROMOTION DASHBOARD ERROR:", error);

        return res.status(500).json({
            message: "Error al obtener datos de promoción.",
            detail: error.message,
        });
    }
}

async function getMembersByLevel(req, res) {
    try {
        const userId = req.user.userId;
        const level = Number(req.params.level);

        if (![1, 2, 3].includes(level)) {
            return res.status(400).json({
                message: "Nivel inválido.",
            });
        }

        const result = await pool.query(
            `
      WITH RECURSIVE team AS (
        SELECT 
          u.id,
          u.email,
          u.created_at,
          u.vip_level,
          1 AS level
        FROM users u
        WHERE u.referred_by_id = $1

        UNION ALL

        SELECT 
          child.id,
          child.email,
          child.created_at,
          child.vip_level,
          team.level + 1 AS level
        FROM users child
        INNER JOIN team ON child.referred_by_id = team.id
        WHERE team.level < 3
      )
      SELECT
        team.id,
        team.email,
        team.created_at,
        team.vip_level,
        (
          SELECT COUNT(*)
          FROM users direct
          WHERE direct.referred_by_id = team.id
        ) AS direct_subordinates
      FROM team
      WHERE team.level = $2
      ORDER BY team.created_at DESC
      `,
            [userId, level]
        );

        const members = result.rows.map((item) => ({
            id: item.id,
            email: maskEmail(item.email),
            vipLevel: Number(item.vip_level || 0),
            directSubordinates: Number(item.direct_subordinates || 0),
            registeredAt: item.created_at,
        }));

        return res.json({
            level,
            members,
        });
    } catch (error) {
        console.error("GET MEMBERS BY LEVEL ERROR:", error);

        return res.status(500).json({
            message: "Error al obtener lista de miembros.",
            detail: error.message,
        });
    }
}

module.exports = {
    getPromotionDashboard,
    getMembersByLevel,
};
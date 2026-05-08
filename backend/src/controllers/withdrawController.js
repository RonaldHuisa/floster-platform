const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const WITHDRAW_FEE_PERCENT = 8;
const MIN_WITHDRAW_USDT = 1;

const WITHDRAW_INVITE_POLICY = {
    requiredActiveInvites: 5,
    vip1StartWithdrawalNumber: 12,
    vip2PlusStartWithdrawalNumber: 6,
    reductionPercent: 75,
};

function isValidBep20Address(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function toNumber(value) {
    return Number(value || 0);
}

function daysSince(dateValue) {
    if (!dateValue) return 0;

    const timestamp = new Date(dateValue).getTime();

    if (!Number.isFinite(timestamp)) return 0;

    return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

async function getActiveDirectInvitesCount(client, userId) {
    const result = await client.query(
        `
        SELECT COUNT(DISTINCT inv.id)::int AS active_direct_invites
        FROM users inv
        WHERE inv.referred_by_id = $1
        AND EXISTS (
            SELECT 1
            FROM vip_purchases vp
            WHERE vp.user_id = inv.id
              AND vp.status = 'active'
              AND vp.expires_at > NOW()
        )
        `,
        [userId]
    );

    return Number(result.rows[0]?.active_direct_invites || 0);
}

async function getWithdrawalHistoryCount(client, userId) {
    const result = await client.query(
        `
        SELECT COUNT(*)::int AS withdrawal_count
        FROM withdrawals
        WHERE user_id = $1
          AND status IN ('pending', 'approved', 'paid')
        `,
        [userId]
    );

    return Number(result.rows[0]?.withdrawal_count || 0);
}

function buildWithdrawInvitePolicy({
    activeVipLevel,
    firstVipPurchasedAt,
    activeDirectInvites,
    previousWithdrawalCount,
}) {
    const vipLevel = Number(activeVipLevel || 0);
    const nextWithdrawalNumber = Number(previousWithdrawalCount || 0) + 1;
    const vipAgeDays = daysSince(firstVipPurchasedAt);

    const isVipEligibleForPolicy = vipLevel >= 1;

    const startWithdrawalNumber =
        vipLevel === 1
            ? WITHDRAW_INVITE_POLICY.vip1StartWithdrawalNumber
            : WITHDRAW_INVITE_POLICY.vip2PlusStartWithdrawalNumber;

    const hasEnoughActiveInvites =
        Number(activeDirectInvites || 0) >= WITHDRAW_INVITE_POLICY.requiredActiveInvites;

    const reachedWithdrawalLimit =
        isVipEligibleForPolicy && nextWithdrawalNumber >= startWithdrawalNumber;

    const applies =
        isVipEligibleForPolicy &&
        reachedWithdrawalLimit &&
        !hasEnoughActiveInvites;

    return {
        applies,
        requiredActiveInvites: WITHDRAW_INVITE_POLICY.requiredActiveInvites,
        activeDirectInvites: Number(activeDirectInvites || 0),
        startWithdrawalNumber,
        vip1StartWithdrawalNumber: WITHDRAW_INVITE_POLICY.vip1StartWithdrawalNumber,
        vip2PlusStartWithdrawalNumber: WITHDRAW_INVITE_POLICY.vip2PlusStartWithdrawalNumber,
        nextWithdrawalNumber,
        previousWithdrawalCount: Number(previousWithdrawalCount || 0),
        reductionPercent: WITHDRAW_INVITE_POLICY.reductionPercent,
        activeVipLevel: vipLevel,
        vipAgeDays,
        isVipEligibleForPolicy,
        hasEnoughActiveInvites,
        reachedWithdrawalLimit,
        message: applies
            ? `Actualmente este retiro tiene una reducción del ${WITHDRAW_INVITE_POLICY.reductionPercent}%. Invita ${WITHDRAW_INVITE_POLICY.requiredActiveInvites} personas activas más y se quitará esta restricción. Podrás retirar el 100% con normalidad.`
            : "",
    };
}

function applyWithdrawInvitePolicy(amountToReceiveBeforePolicy, policy) {
    const baseAmount = Number(amountToReceiveBeforePolicy || 0);

    if (!policy?.applies) {
        return {
            policyReductionAmount: 0,
            amountToReceive: baseAmount,
        };
    }

    const policyReductionAmount =
        baseAmount * (Number(policy.reductionPercent || 0) / 100);

    return {
        policyReductionAmount,
        amountToReceive: baseAmount - policyReductionAmount,
    };
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
            SELECT 
                u.id, 
                u.withdrawable_usdt, 
                u.withdrawal_address_bep20,
                COALESCE((
                    SELECT MAX(vp.level)
                    FROM vip_purchases vp
                    WHERE vp.user_id = u.id
                      AND vp.status = 'active'
                      AND vp.expires_at > NOW()
                ), 0) AS active_vip_level,
                (
                    SELECT MIN(vp.purchased_at)
                    FROM vip_purchases vp
                    WHERE vp.user_id = u.id
                      AND vp.status IN ('active', 'completed', 'expired')
                ) AS first_vip_purchased_at
            FROM users u
            WHERE u.id = $1
            `,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Usuario no encontrado.",
            });
        }

        const user = result.rows[0];

        const activeDirectInvites = await getActiveDirectInvitesCount(pool, userId);
        const previousWithdrawalCount = await getWithdrawalHistoryCount(pool, userId);

        const withdrawalPolicy = buildWithdrawInvitePolicy({
            activeVipLevel: user.active_vip_level,
            firstVipPurchasedAt: user.first_vip_purchased_at,
            activeDirectInvites,
            previousWithdrawalCount,
        });

        const hasActiveVip = Number(user.active_vip_level || 0) > 0;

        return res.json({
            available: user.withdrawable_usdt || "0",
            network: "BEP20-USDT",
            feePercent: WITHDRAW_FEE_PERCENT,
            minWithdraw: MIN_WITHDRAW_USDT,
            withdrawalAddress: user.withdrawal_address_bep20,
            addressLocked: Boolean(user.withdrawal_address_bep20),
            canWithdraw: hasActiveVip,
            hasActiveVip,
            activeVipLevel: Number(user.active_vip_level || 0),
            withdrawRequirementMessage:
                "Debes tener un VIP activo para solicitar retiros.",
            withdrawalPolicy,
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
                u.id, 
                u.password_hash AS password,
                u.withdrawable_usdt, 
                u.withdrawal_address_bep20,
                COALESCE((
                    SELECT MAX(vp.level)
                    FROM vip_purchases vp
                    WHERE vp.user_id = u.id
                      AND vp.status = 'active'
                      AND vp.expires_at > NOW()
                ), 0) AS active_vip_level,
                (
                    SELECT MIN(vp.purchased_at)
                    FROM vip_purchases vp
                    WHERE vp.user_id = u.id
                      AND vp.status IN ('active', 'completed', 'expired')
                ) AS first_vip_purchased_at
            FROM users u
            WHERE u.id = $1
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

        if (Number(user.active_vip_level || 0) <= 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message: "Debes tener un VIP activo para solicitar retiros.",
            });
        }

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

        const activeDirectInvites = await getActiveDirectInvitesCount(client, userId);
        const previousWithdrawalCount = await getWithdrawalHistoryCount(client, userId);

        const withdrawalPolicy = buildWithdrawInvitePolicy({
            activeVipLevel: user.active_vip_level,
            firstVipPurchasedAt: user.first_vip_purchased_at,
            activeDirectInvites,
            previousWithdrawalCount,
        });

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
        const amountToReceiveBeforePolicy = amountNumber - feeAmount;
        const policyResult = applyWithdrawInvitePolicy(
            amountToReceiveBeforePolicy,
            withdrawalPolicy
        );
        const policyReductionAmount = policyResult.policyReductionAmount;
        const amountToReceive = policyResult.amountToReceive;

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
                    policy_reduction_percent: withdrawalPolicy.applies
                        ? withdrawalPolicy.reductionPercent
                        : 0,
                    policy_reduction_amount: policyReductionAmount,
                    active_direct_invites: withdrawalPolicy.activeDirectInvites,
                    required_active_invites: withdrawalPolicy.requiredActiveInvites,
                    next_withdrawal_number: withdrawalPolicy.nextWithdrawalNumber,
                    active_vip_level: withdrawalPolicy.activeVipLevel,
                    amount_to_receive_before_policy: amountToReceiveBeforePolicy,
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
            withdrawalPolicy: {
                ...withdrawalPolicy,
                policyReductionAmount,
                amountToReceiveBeforePolicy,
                amountToReceive,
            },
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
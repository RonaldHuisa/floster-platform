const pool = require("../config/db");
const { getBep20UsdtTransfers } = require("../services/moralisService");
const { ethers } = require("ethers");
const { sweepUserPendingDeposits } = require("../services/sweepService");

function formatUsdtRaw(rawAmount) {
    const decimals = Number(process.env.BSC_USDT_DECIMALS || 18);
    return ethers.formatUnits(rawAmount.toString(), decimals);
}

async function scanMyDeposits(req, res) {
    const userId = req.user.userId;
    const client = await pool.connect();

    try {
        const walletResult = await client.query(
            `
      SELECT id, user_id, network, address, last_scanned_block, created_at
      FROM wallets
      WHERE user_id = $1
      LIMIT 1
      `,
            [userId]
        );

        if (walletResult.rows.length === 0) {
            return res.status(404).json({
                message: "No se encontró wallet para este usuario.",
            });
        }

        const wallet = walletResult.rows[0];
        const lastScannedBlock = Number(wallet.last_scanned_block || 0);

        const options = {};

        if (lastScannedBlock > 0) {
            const lookbackBlocks = Number(process.env.BSC_RESCAN_LOOKBACK_BLOCKS || 300);
            options.fromBlock = Math.max(lastScannedBlock - lookbackBlocks, 0);
        } else if (wallet.created_at) {
            options.fromDate = new Date(wallet.created_at).toISOString();
        }

        const transfers = await getBep20UsdtTransfers(wallet.address, options);

        await client.query("BEGIN");

        let addedDeposits = 0;
        let detectedTransfers = transfers.length;
        let addedAmountRaw = 0n;
        let highestBlock = lastScannedBlock;

        for (const transfer of transfers) {
            if (transfer.blockNumber > highestBlock) {
                highestBlock = transfer.blockNumber;
            }

            const insertedDeposit = await client.query(
                `
        INSERT INTO deposits
        (
          user_id,
          wallet_id,
          network,
          token_contract,
          tx_hash,
          log_index,
          block_number,
          amount_raw,
          amount_usdt,
          status
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (tx_hash, log_index) DO NOTHING
        RETURNING id
        `,
                [
                    userId,
                    wallet.id,
                    "BEP20-USDT",
                    transfer.tokenContract,
                    transfer.txHash,
                    transfer.logIndex,
                    transfer.blockNumber,
                    transfer.amountRaw,
                    transfer.amountUsdt,
                    "confirmed",
                ]
            );

            if (insertedDeposit.rows.length > 0) {
                addedDeposits += 1;
                addedAmountRaw += BigInt(transfer.amountRaw);

                await client.query(
                    `
          UPDATE users
          SET balance_usdt = balance_usdt + $1
          WHERE id = $2
          `,
                    [transfer.amountUsdt, userId]
                );
            }
        }

        if (highestBlock > lastScannedBlock) {
            await client.query(
                `
        UPDATE wallets
        SET last_scanned_block = $1
        WHERE id = $2
        `,
                [highestBlock, wallet.id]
            );
        }

        const balanceResult = await client.query(
            `
      SELECT balance_usdt
      FROM users
      WHERE id = $1
      `,
            [userId]
        );

        await client.query("COMMIT");
        const sweepResult = await sweepUserPendingDeposits(userId);
        let message = "No se encontraron depósitos nuevos todavía.";

        if (addedDeposits > 0) {
            message = "Depósito detectado y acreditado correctamente.";
        } else if (detectedTransfers > 0) {
            message = "El depósito ya fue procesado anteriormente.";
        }

        return res.json({
            message:
                addedDeposits > 0
                    ? "Depósito detectado y acreditado correctamente."
                    : "No se encontraron depósitos nuevos todavía.",
            detectedTransfers,
            addedDeposits,
            addedAmount: formatUsdtRaw(addedAmountRaw),
            currentBalance: balanceResult.rows[0]?.balance_usdt || "0",
            sweep: sweepResult,
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("SCAN DEPOSITS ERROR:", error);

        return res.status(500).json({
            message: "Error al verificar depósitos con Moralis.",
            detail: error.message,
        });
    } finally {
        client.release();
    }
}

module.exports = {
    scanMyDeposits,
};
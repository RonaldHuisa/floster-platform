const pool = require("../config/db");
const { getEvmUsdtTransfers } = require("../services/moralisService");
const { ethers } = require("ethers");
const { sweepUserPendingDeposits } = require("../services/sweepService");
const {
  getPaymentNetwork,
  getNetworkTokenDecimals,
  listPaymentNetworks,
} = require("../utils/paymentNetworks");

function formatTokenRaw(rawAmount, decimals) {
  return ethers.formatUnits(rawAmount.toString(), decimals);
}

async function ensurePaymentNetworkScan(client, walletId, networkCode) {
  await client.query(
    `
    CREATE TABLE IF NOT EXISTS payment_network_scans (
      id SERIAL PRIMARY KEY,
      wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
      network VARCHAR(30) NOT NULL,
      last_scanned_block INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(wallet_id, network)
    )
    `
  );

  const result = await client.query(
    `
    INSERT INTO payment_network_scans (wallet_id, network, last_scanned_block)
    VALUES ($1, $2, 0)
    ON CONFLICT (wallet_id, network) DO NOTHING
    RETURNING id, last_scanned_block
    `,
    [walletId, networkCode]
  );

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  const scanResult = await client.query(
    `
    SELECT id, last_scanned_block
    FROM payment_network_scans
    WHERE wallet_id = $1
      AND network = $2
    LIMIT 1
    `,
    [walletId, networkCode]
  );

  return scanResult.rows[0];
}

async function scanMyDeposits(req, res) {
  const userId = req.user.userId;
  const network = getPaymentNetwork(req.body?.network || req.query.network || "BEP20-USDT", {
    deposit: true,
  });
  const client = await pool.connect();

  try {
    const walletResult = await client.query(
      `
      SELECT id, user_id, network, address, last_scanned_block, created_at
      FROM wallets
      WHERE user_id = $1
      ORDER BY 
        CASE WHEN network = $2 THEN 0 ELSE 1 END,
        id ASC
      LIMIT 1
      `,
      [userId, network.code]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({
        message: "No se encontró wallet para este usuario.",
      });
    }

    const wallet = walletResult.rows[0];
    const scanState = await ensurePaymentNetworkScan(client, wallet.id, network.code);
    const lastScannedBlock = Number(scanState?.last_scanned_block || 0);

    const options = {};

    if (lastScannedBlock > 0) {
      const lookbackBlocks = Number(process.env.EVM_RESCAN_LOOKBACK_BLOCKS || process.env.BSC_RESCAN_LOOKBACK_BLOCKS || 300);
      options.fromBlock = Math.max(lastScannedBlock - lookbackBlocks, 0);
    } else if (wallet.created_at) {
      options.fromDate = new Date(wallet.created_at).toISOString();
    }

    const transfers = await getEvmUsdtTransfers(wallet.address, network.code, options);

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
          network.code,
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
          SET balance_usdt = COALESCE(balance_usdt, 0) + $1
          WHERE id = $2
          `,
          [transfer.amountUsdt, userId]
        );
      }
    }

    if (highestBlock > lastScannedBlock) {
      await client.query(
        `
        UPDATE payment_network_scans
        SET last_scanned_block = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE wallet_id = $2
          AND network = $3
        `,
        [highestBlock, wallet.id, network.code]
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

    const sweepResult = await sweepUserPendingDeposits(userId, network.code);

    return res.json({
      message:
        addedDeposits > 0
          ? "Depósito detectado y acreditado correctamente."
          : "No se encontraron depósitos nuevos todavía.",
      network: network.code,
      detectedTransfers,
      addedDeposits,
      addedAmount: formatTokenRaw(addedAmountRaw, getNetworkTokenDecimals(network)),
      currentBalance: balanceResult.rows[0]?.balance_usdt || "0",
      sweep: sweepResult,
      supportedNetworks: listPaymentNetworks().filter((item) => item.depositEnabled),
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

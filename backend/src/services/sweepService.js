const { ethers } = require("ethers");
const pool = require("../config/db");
const { decryptText } = require("../utils/cryptoUtil");
const {
  getPaymentNetwork,
  getNetworkRpcUrl,
  getNetworkTokenContract,
  getNetworkCollectionWallet,
  getNetworkPlatformPrivateKey,
  getNetworkTopupBuffer,
} = require("../utils/paymentNetworks");
require("dotenv").config();

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

function sumRawAmounts(deposits) {
  return deposits.reduce((total, deposit) => {
    return total + BigInt(deposit.amount_raw);
  }, 0n);
}

async function getGasPrice(provider, network) {
  const feeData = await provider.getFeeData();

  if (!feeData.gasPrice) {
    throw new Error(`No se pudo obtener gasPrice en ${network.code}.`);
  }

  return feeData.gasPrice;
}

async function ensureUserHasNativeGas({
  provider,
  network,
  userWalletAddress,
  userSigner,
  tokenContract,
  amountRaw,
  collectionWallet,
}) {
  const platformSigner = new ethers.Wallet(
    getNetworkPlatformPrivateKey(network),
    provider
  );

  const nativeBalance = await provider.getBalance(userWalletAddress);
  const gasPrice = await getGasPrice(provider, network);

  let gasLimit;

  try {
    gasLimit = await tokenContract
      .connect(userSigner)
      .transfer
      .estimateGas(collectionWallet, amountRaw);
  } catch (error) {
    console.log(`No se pudo estimar gas en ${network.code}, usando fallback 100000.`);
    gasLimit = 100000n;
  }

  const requiredNative = gasLimit * gasPrice + getNetworkTopupBuffer(network);

  if (nativeBalance >= requiredNative) {
    return {
      sent: false,
      txHash: null,
      requiredNative: ethers.formatEther(requiredNative),
      currentNative: ethers.formatEther(nativeBalance),
      nativeSymbol: network.nativeSymbol,
    };
  }

  const amountToSend = requiredNative - nativeBalance;

  const tx = await platformSigner.sendTransaction({
    to: userWalletAddress,
    value: amountToSend,
  });

  console.log(`Enviando ${network.nativeSymbol} al usuario:`, tx.hash);

  const receipt = await tx.wait(1);

  return {
    sent: true,
    txHash: receipt.hash,
    requiredNative: ethers.formatEther(requiredNative),
    sentNative: ethers.formatEther(amountToSend),
    nativeSymbol: network.nativeSymbol,
  };
}

async function sweepUserPendingDeposits(userId, networkCode = "BEP20-USDT") {
  const network = getPaymentNetwork(networkCode, { deposit: true });
  const provider = new ethers.JsonRpcProvider(getNetworkRpcUrl(network));
  const tokenContractAddress = getNetworkTokenContract(network);
  const collectionWallet = getNetworkCollectionWallet(network);

  const client = await pool.connect();

  try {
    const walletResult = await client.query(
      `
      SELECT id, address, private_key_encrypted
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
      return {
        status: "no_wallet",
        message: "No se encontró wallet del usuario.",
      };
    }

    const wallet = walletResult.rows[0];

    const depositsResult = await client.query(
      `
      SELECT id, amount_raw, amount_usdt
      FROM deposits
      WHERE user_id = $1
        AND wallet_id = $2
        AND network = $3
        AND sweep_status = 'pending'
      ORDER BY id ASC
      `,
      [userId, wallet.id, network.code]
    );

    const pendingDeposits = depositsResult.rows;

    if (pendingDeposits.length === 0) {
      return {
        status: "nothing_pending",
        message: "No hay depósitos pendientes para mover.",
        network: network.code,
      };
    }

    const amountRawToSweep = sumRawAmounts(pendingDeposits);

    if (amountRawToSweep <= 0n) {
      return {
        status: "invalid_amount",
        message: "El monto pendiente es inválido.",
        network: network.code,
      };
    }

    const userPrivateKey = decryptText(wallet.private_key_encrypted);
    const userSigner = new ethers.Wallet(userPrivateKey, provider);

    const tokenContract = new ethers.Contract(
      tokenContractAddress,
      ERC20_ABI,
      provider
    );

    const contractCode = await provider.getCode(tokenContractAddress);

    if (!contractCode || contractCode === "0x") {
      throw new Error(
        `El contrato USDT de ${network.code} no existe en la red configurada. Revisa ${network.rpcUrlEnv} y ${network.tokenContractEnv}.`
      );
    }

    const userTokenBalance = await tokenContract.balanceOf(wallet.address);

    if (userTokenBalance < amountRawToSweep) {
      return {
        status: "insufficient_usdt",
        message: "La wallet del usuario todavía no tiene suficiente USDT disponible.",
        walletBalanceRaw: userTokenBalance.toString(),
        requiredRaw: amountRawToSweep.toString(),
        network: network.code,
      };
    }

    const nativeTopup = await ensureUserHasNativeGas({
      provider,
      network,
      userWalletAddress: wallet.address,
      userSigner,
      tokenContract,
      amountRaw: amountRawToSweep,
      collectionWallet,
    });

    const sweepTx = await tokenContract
      .connect(userSigner)
      .transfer(collectionWallet, amountRawToSweep, {
        gasLimit: 100000n,
      });

    console.log(`Enviando USDT ${network.code} a wallet central:`, sweepTx.hash);

    const sweepReceipt = await sweepTx.wait(1);

    const depositIds = pendingDeposits.map((item) => item.id);

    await client.query(
      `
      UPDATE deposits
      SET
        sweep_status = 'swept',
        bnb_topup_tx_hash = COALESCE($1, bnb_topup_tx_hash),
        sweep_tx_hash = $2,
        swept_at = CURRENT_TIMESTAMP
      WHERE id = ANY($3::int[])
      `,
      [nativeTopup.txHash, sweepReceipt.hash, depositIds]
    );

    return {
      status: "swept",
      message: "USDT enviado correctamente a la wallet central.",
      network: network.code,
      depositsSwept: pendingDeposits.length,
      amountRawSwept: amountRawToSweep.toString(),
      nativeTopup,
      sweepTxHash: sweepReceipt.hash,
    };
  } catch (error) {
    console.error("SWEEP ERROR:", error);

    await client.query(
      `
      UPDATE deposits
      SET sweep_status = 'failed'
      WHERE user_id = $1
        AND network = $2
        AND sweep_status = 'pending'
      `,
      [userId, network.code]
    );

    return {
      status: "failed",
      network: network.code,
      message: "Error al enviar gas o mover USDT.",
      detail: error.message,
    };
  } finally {
    client.release();
  }
}


async function sweepAllPendingDeposits(limit = 25) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      SELECT DISTINCT
        d.user_id,
        d.network
      FROM deposits d
      WHERE d.sweep_status = 'pending'
        AND d.status = 'confirmed'
      ORDER BY d.user_id ASC, d.network ASC
      LIMIT $1
      `,
      [limit]
    );

    const pendingGroups = result.rows;
    const results = [];

    for (const item of pendingGroups) {
      try {
        const sweepResult = await sweepUserPendingDeposits(
          item.user_id,
          item.network || "BEP20-USDT"
        );

        results.push({
          userId: item.user_id,
          network: item.network,
          ...sweepResult,
        });
      } catch (error) {
        results.push({
          userId: item.user_id,
          network: item.network,
          status: "failed",
          message: error.message,
        });
      }
    }

    return results;
  } finally {
    client.release();
  }
}


module.exports = {
  sweepUserPendingDeposits,
  sweepAllPendingDeposits,
};

const { ethers } = require("ethers");
const pool = require("../config/db");
const { decryptText } = require("../utils/cryptoUtil");
require("dotenv").config();

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);

const USDT_CONTRACT = process.env.BSC_USDT_CONTRACT;
const COLLECTION_USDT_WALLET = process.env.COLLECTION_USDT_WALLET;
const PLATFORM_BNB_PRIVATE_KEY = process.env.PLATFORM_BNB_PRIVATE_KEY;

function requireEnv() {
  if (!process.env.BSC_RPC_URL) {
    throw new Error("Falta BSC_RPC_URL en .env");
  }

  if (!USDT_CONTRACT) {
    throw new Error("Falta BSC_USDT_CONTRACT en .env");
  }

  if (!COLLECTION_USDT_WALLET) {
    throw new Error("Falta COLLECTION_USDT_WALLET en .env");
  }

  if (!PLATFORM_BNB_PRIVATE_KEY) {
    throw new Error("Falta PLATFORM_BNB_PRIVATE_KEY en .env");
  }
}

function sumRawAmounts(deposits) {
  return deposits.reduce((total, deposit) => {
    return total + BigInt(deposit.amount_raw);
  }, 0n);
}

async function getGasPrice() {
  const feeData = await provider.getFeeData();

  if (!feeData.gasPrice) {
    throw new Error("No se pudo obtener gasPrice de BSC.");
  }

  return feeData.gasPrice;
}

async function ensureUserHasBNB(userWalletAddress, userSigner, usdtContract, amountRaw) {
  const platformSigner = new ethers.Wallet(PLATFORM_BNB_PRIVATE_KEY, provider);

  const bnbBalance = await provider.getBalance(userWalletAddress);
  const gasPrice = await getGasPrice();

  let gasLimit;

  try {
    gasLimit = await usdtContract
      .connect(userSigner)
      .transfer
      .estimateGas(COLLECTION_USDT_WALLET, amountRaw);
  } catch (error) {
    console.log("No se pudo estimar gas, usando fallback 100000.");
    gasLimit = 100000n;
  }

  const buffer = ethers.parseEther(process.env.BNB_TOPUP_BUFFER || "0.00005");
  const requiredBNB = gasLimit * gasPrice + buffer;

  if (bnbBalance >= requiredBNB) {
    return {
      sent: false,
      txHash: null,
      requiredBNB: ethers.formatEther(requiredBNB),
      currentBNB: ethers.formatEther(bnbBalance),
    };
  }

  const amountToSend = requiredBNB - bnbBalance;

  const tx = await platformSigner.sendTransaction({
    to: userWalletAddress,
    value: amountToSend,
  });

  console.log("Enviando BNB al usuario:", tx.hash);

  const receipt = await tx.wait(1);

  return {
    sent: true,
    txHash: receipt.hash,
    requiredBNB: ethers.formatEther(requiredBNB),
    sentBNB: ethers.formatEther(amountToSend),
  };
}

async function sweepUserPendingDeposits(userId) {
  requireEnv();

  const client = await pool.connect();

  try {
    const walletResult = await client.query(
      `
      SELECT id, address, private_key_encrypted
      FROM wallets
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
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
      AND sweep_status = 'pending'
      ORDER BY id ASC
      `,
      [userId, wallet.id]
    );

    const pendingDeposits = depositsResult.rows;

    if (pendingDeposits.length === 0) {
      return {
        status: "nothing_pending",
        message: "No hay depósitos pendientes para mover.",
      };
    }

    const amountRawToSweep = sumRawAmounts(pendingDeposits);

    if (amountRawToSweep <= 0n) {
      return {
        status: "invalid_amount",
        message: "El monto pendiente es inválido.",
      };
    }

    const userPrivateKey = decryptText(wallet.private_key_encrypted);
    const userSigner = new ethers.Wallet(userPrivateKey, provider);

    const usdtContract = new ethers.Contract(
      USDT_CONTRACT,
      ERC20_ABI,
      provider
    );

    const userUsdtBalance = await usdtContract.balanceOf(wallet.address);

    if (userUsdtBalance < amountRawToSweep) {
      return {
        status: "insufficient_usdt",
        message: "La wallet del usuario todavía no tiene suficiente USDT disponible.",
        walletBalanceRaw: userUsdtBalance.toString(),
        requiredRaw: amountRawToSweep.toString(),
      };
    }

    const bnbTopup = await ensureUserHasBNB(
      wallet.address,
      userSigner,
      usdtContract,
      amountRawToSweep
    );

    const sweepTx = await usdtContract
      .connect(userSigner)
      .transfer(COLLECTION_USDT_WALLET, amountRawToSweep, {
        gasLimit: 100000n,
      });

    console.log("Enviando USDT a wallet central:", sweepTx.hash);

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
      [bnbTopup.txHash, sweepReceipt.hash, depositIds]
    );

    return {
      status: "swept",
      message: "USDT enviado correctamente a la wallet central.",
      depositsSwept: pendingDeposits.length,
      amountRawSwept: amountRawToSweep.toString(),
      bnbTopup,
      sweepTxHash: sweepReceipt.hash,
    };
  } catch (error) {
    console.error("SWEEP ERROR:", error);

    await client.query(
      `
      UPDATE deposits
      SET sweep_status = 'failed'
      WHERE user_id = $1
      AND sweep_status = 'pending'
      `,
      [userId]
    );

    return {
      status: "failed",
      message: "Error al enviar BNB o mover USDT.",
      detail: error.message,
    };
  } finally {
    client.release();
  }
}

module.exports = {
  sweepUserPendingDeposits,
};
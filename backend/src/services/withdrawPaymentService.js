const { ethers } = require("ethers");
require("dotenv").config();

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);

const USDT_CONTRACT = process.env.BSC_USDT_CONTRACT;
const USDT_DECIMALS = Number(process.env.BSC_USDT_DECIMALS || 18);
const HOT_WALLET_PRIVATE_KEY = process.env.WITHDRAW_HOT_WALLET_PRIVATE_KEY;

function requireConfig() {
  if (!process.env.BSC_RPC_URL) {
    throw new Error("Falta BSC_RPC_URL en .env");
  }

  if (!USDT_CONTRACT) {
    throw new Error("Falta BSC_USDT_CONTRACT en .env");
  }

  if (!HOT_WALLET_PRIVATE_KEY) {
    throw new Error("Falta WITHDRAW_HOT_WALLET_PRIVATE_KEY en .env");
  }
}

function isValidBep20Address(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function sendUsdtWithdrawal(toAddress, amountUsdt) {
  requireConfig();

  if (!isValidBep20Address(toAddress)) {
    throw new Error("Dirección BEP20 inválida.");
  }

  const signer = new ethers.Wallet(HOT_WALLET_PRIVATE_KEY, provider);

  const usdtContract = new ethers.Contract(
    USDT_CONTRACT,
    ERC20_ABI,
    signer
  );

  const amountRaw = ethers.parseUnits(String(amountUsdt), USDT_DECIMALS);

  const hotWalletAddress = await signer.getAddress();

  const usdtBalance = await usdtContract.balanceOf(hotWalletAddress);

  if (usdtBalance < amountRaw) {
    throw new Error("La wallet hot no tiene suficiente USDT.");
  }

  const bnbBalance = await provider.getBalance(hotWalletAddress);

  if (bnbBalance <= 0n) {
    throw new Error("La wallet hot no tiene BNB para pagar gas.");
  }

  const tx = await usdtContract.transfer(toAddress, amountRaw);

  console.log("WITHDRAW USDT TX:", tx.hash);

  const receipt = await tx.wait(1);

  return {
    txHash: receipt.hash,
    from: hotWalletAddress,
    to: toAddress,
    amountUsdt,
  };
}

module.exports = {
  sendUsdtWithdrawal,
};
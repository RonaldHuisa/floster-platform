const { ethers } = require("ethers");
require("dotenv").config();

const {
  getPaymentNetwork,
  getNetworkTokenContract,
  getNetworkTokenDecimals,
} = require("../utils/paymentNetworks");

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

if (!MORALIS_API_KEY) {
  throw new Error("Falta MORALIS_API_KEY en el archivo .env");
}

function normalizeAddress(address) {
  return String(address || "").toLowerCase();
}

function formatTokenAmount(rawValue, decimals) {
  return ethers.formatUnits(rawValue.toString(), decimals);
}

async function getEvmUsdtTransfers(walletAddress, networkCode = "BEP20-USDT", options = {}) {
  const network = getPaymentNetwork(networkCode, { deposit: true });
  const tokenContract = getNetworkTokenContract(network);
  const tokenDecimals = getNetworkTokenDecimals(network);

  const transfers = [];
  let cursor = null;

  const walletLower = normalizeAddress(walletAddress);
  const contractLower = normalizeAddress(tokenContract);

  do {
    const url = new URL(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20/transfers`
    );

    url.searchParams.set("chain", network.moralisChain);
    url.searchParams.append("contract_addresses", tokenContract);
    url.searchParams.set("limit", "100");
    url.searchParams.set("order", "ASC");

    if (options.fromBlock && Number(options.fromBlock) > 0) {
      url.searchParams.set("from_block", String(options.fromBlock));
    } else if (options.fromDate) {
      url.searchParams.set("from_date", options.fromDate);
    }

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-Key": MORALIS_API_KEY,
        accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("MORALIS ERROR:", data);
      throw new Error(data.message || `Error consultando Moralis en ${network.code}.`);
    }

    const result = Array.isArray(data.result) ? data.result : [];

    for (const tx of result) {
      const toAddress = normalizeAddress(tx.to_address);
      const contractAddress = normalizeAddress(tx.address);

      if (toAddress !== walletLower) continue;
      if (contractAddress !== contractLower) continue;

      const decimals = Number(tx.token_decimals || tokenDecimals);
      const amountUsdt = formatTokenAmount(tx.value, decimals);

      transfers.push({
        txHash: tx.transaction_hash,
        logIndex: Number(tx.log_index || 0),
        blockNumber: Number(tx.block_number),
        amountRaw: tx.value.toString(),
        amountUsdt,
        tokenContract: tx.address,
        fromAddress: tx.from_address,
        toAddress: tx.to_address,
        blockTimestamp: tx.block_timestamp,
        tokenDecimals: decimals,
        network: network.code,
      });
    }

    cursor = data.cursor || null;
  } while (cursor);

  return transfers;
}

// Compatibilidad con el código anterior
async function getBep20UsdtTransfers(walletAddress, options = {}) {
  return getEvmUsdtTransfers(walletAddress, "BEP20-USDT", options);
}

module.exports = {
  getEvmUsdtTransfers,
  getBep20UsdtTransfers,
};

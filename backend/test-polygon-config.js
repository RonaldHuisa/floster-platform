require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  console.log("POLYGON_RPC_URL:", process.env.POLYGON_RPC_URL ? "OK" : "FALTA");
  console.log("POLYGON_USDT_CONTRACT:", process.env.POLYGON_USDT_CONTRACT || "FALTA");

  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const network = await provider.getNetwork();

  console.log("Network chainId:", network.chainId.toString());

  const contract = process.env.POLYGON_USDT_CONTRACT;
  const code = await provider.getCode(contract);

  console.log("Contract code:", code === "0x" ? "0x - NO ES CONTRATO EN ESTA RED" : "OK");

  if (code === "0x") {
    console.log("Revisa POLYGON_RPC_URL o POLYGON_USDT_CONTRACT.");
    return;
  }

  const walletToCheck = process.argv[2];

  if (!walletToCheck) {
    console.log("Opcional: node test-polygon-config.js 0xWallet");
    return;
  }

  const abi = ["function balanceOf(address account) view returns (uint256)"];
  const usdt = new ethers.Contract(contract, abi, provider);
  const balance = await usdt.balanceOf(walletToCheck);

  console.log("Wallet:", walletToCheck);
  console.log("USDT raw:", balance.toString());
  console.log("USDT:", ethers.formatUnits(balance, Number(process.env.POLYGON_USDT_DECIMALS || 6)));
}

main().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});

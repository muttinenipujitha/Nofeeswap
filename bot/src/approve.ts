// bot/src/approve.ts
// Helper script: approve the Operator to spend bot's ALPHA and BETA tokens.
// Run ONCE after deployment: ts-node src/approve.ts

import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL ?? "http://127.0.0.1:8545");
  const wallet = new ethers.Wallet(
    process.env.PRIVATE_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    provider
  );
  const operator = process.env.NOFEESWAP_OPERATOR ?? "";
  const tokenAlpha = process.env.TOKEN_ALPHA ?? "";
  const tokenBeta  = process.env.TOKEN_BETA  ?? "";

  if (!operator || operator.includes("0000000000000000000000000000000000000000")) {
    console.error("Set NOFEESWAP_OPERATOR in .env first");
    process.exit(1);
  }

  for (const tokenAddr of [tokenAlpha, tokenBeta]) {
    const token = new ethers.Contract(tokenAddr, ERC20_ABI, wallet);
    const sym = await token.symbol();
    const current = await token.allowance(wallet.address, operator);

    if (current >= ethers.MaxUint256 / 2n) {
      console.log(`${sym}: already approved`);
      continue;
    }

    console.log(`Approving ${sym}...`);
    const tx = await token.approve(operator, ethers.MaxUint256);
    await tx.wait();
    console.log(`${sym}: approved ✅`);
  }

  // Mine the approval block
  await provider.send("anvil_mine", [1]);
  console.log("Approvals mined.");
}

main().catch(console.error);

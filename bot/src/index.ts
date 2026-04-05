// bot/src/index.ts
// NoFeeSwap Sandwich Bot — Mempool Monitor
//
// Subscribes to pending transactions on the local Anvil node and watches for
// swap() calls targeting the NoFeeSwap Operator contract.
// When detected, decodes the calldata, checks profitability, and executes a
// sandwich attack (front-run → victim → back-run) using nonce/gas ordering.
//
// IMPORTANT: Anvil must be started with --no-mining for this to work:
//   anvil --no-mining --chain-id 31337 --port 8545

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { decodeSwapCalldata, SWAP_SELECTOR, formatDecodedSwap } from "./decoder";
import { executeSandwich, SandwichConfig } from "./sandwich";

dotenv.config();

// ── Configuration ────────────────────────────────────────────────────────────
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const OPERATOR_ADDRESS = process.env.NOFEESWAP_OPERATOR ?? "0x0000000000000000000000000000000000000000";
const TOKEN_ALPHA = process.env.TOKEN_ALPHA ?? "0x0000000000000000000000000000000000000000";
const TOKEN_BETA = process.env.TOKEN_BETA ?? "0x0000000000000000000000000000000000000000";

// Minimum profitability threshold (in wei) before attempting sandwich
const MIN_PROFIT_WEI = ethers.parseUnits("0.001", 18); // 0.001 ETH equivalent

// ── Stats tracking ───────────────────────────────────────────────────────────
const stats = {
  scanned: 0,
  swapsDetected: 0,
  sandwichesAttempted: 0,
  sandwichesSucceeded: 0,
  totalProfit: 0n,
};

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║        NoFeeSwap Sandwich Bot  v1.0.0                ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`[BOT] RPC:      ${RPC_URL}`);
  console.log(`[BOT] Operator: ${OPERATOR_ADDRESS}`);
  console.log(`[BOT] ALPHA:    ${TOKEN_ALPHA}`);
  console.log(`[BOT] BETA:     ${TOKEN_BETA}`);
  console.log("");

  // ── Provider setup ────────────────────────────────────────────────────────
  // Use WebSocket provider for subscription support
  // Anvil supports ws:// on the same port as http://
  const wsUrl = RPC_URL.replace("http://", "ws://").replace("https://", "wss://");

  let provider: ethers.JsonRpcProvider | ethers.WebSocketProvider;

  try {
    provider = new ethers.WebSocketProvider(wsUrl);
    console.log("[BOT] Connected via WebSocket:", wsUrl);
  } catch {
    // Fallback to polling-based JSON-RPC if WS fails
    provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("[BOT] Connected via HTTP polling:", RPC_URL);
  }

  const botWallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const botAddress = await botWallet.getAddress();
  const botBalance = await provider.getBalance(botAddress);

  console.log(`[BOT] Bot wallet: ${botAddress}`);
  console.log(`[BOT] Bot balance: ${ethers.formatEther(botBalance)} ETH`);
  console.log("");

  if (botBalance === 0n) {
    console.warn("[BOT] ⚠️  Bot wallet has zero balance — fund it with test ETH!");
  }

  // Verify Anvil mining mode
  try {
    const miningStatus = await provider.send("anvil_getAutomine", []);
    if (miningStatus === true) {
      console.warn("[BOT] ⚠️  Anvil is in AUTO-MINE mode.");
      console.warn("[BOT]    Transactions mine instantly — bot cannot intercept them.");
      console.warn("[BOT]    Restart Anvil with: anvil --no-mining");
      console.warn("");
    } else {
      console.log("[BOT] ✅ Anvil mining: MANUAL (--no-mining active)");
    }
  } catch {
    console.log("[BOT] Could not check mining mode (non-Anvil node?)");
  }

  const config: SandwichConfig = {
    provider: provider as ethers.JsonRpcProvider,
    botWallet,
    operatorAddress: OPERATOR_ADDRESS,
    token0Address: TOKEN_ALPHA,
    token1Address: TOKEN_BETA,
  };

  // ── Mempool monitoring ────────────────────────────────────────────────────
  console.log("[BOT] Monitoring mempool for NoFeeSwap swaps...");
  console.log("━".repeat(55));

  // Track seen tx hashes to avoid double-processing
  const seenTxHashes = new Set<string>();
  // Track in-progress sandwiches to avoid concurrent attempts
  let sandwichInProgress = false;

  /**
   * Process a pending transaction hash.
   * Fetches the full tx, checks if it's a swap, and attempts sandwich.
   */
  async function processPendingTx(txHash: string) {
    if (seenTxHashes.has(txHash)) return;
    seenTxHashes.add(txHash);
    stats.scanned++;

    if (stats.scanned % 50 === 0) {
      console.log(`[BOT] Stats: scanned=${stats.scanned} swaps=${stats.swapsDetected} sandwiches=${stats.sandwichesSucceeded}/${stats.sandwichesAttempted}`);
    }

    let tx: ethers.TransactionResponse | null;
    try {
      tx = await provider.getTransaction(txHash);
    } catch {
      return; // tx fetch failed (normal during high traffic)
    }

    if (!tx || !tx.to || !tx.data) return;

    // ── Filter: must be targeting our Operator contract ───────────────────
    const isTargetingOperator =
      tx.to.toLowerCase() === OPERATOR_ADDRESS.toLowerCase();

    if (!isTargetingOperator) return;

    // ── Filter: must be a swap() call ─────────────────────────────────────
    if (!tx.data.startsWith(SWAP_SELECTOR)) return;

    // ── Decode calldata ───────────────────────────────────────────────────
    const decoded = decodeSwapCalldata(tx.data);
    if (!decoded) return;

    stats.swapsDetected++;

    console.log("");
    console.log(`[BOT] 🎯 VICTIM SWAP DETECTED`);
    console.log(`  Tx hash:    ${txHash}`);
    console.log(`  From:       ${tx.from}`);
    console.log(`  Gas price:  ${ethers.formatUnits(tx.gasPrice ?? 0n, "gwei")} gwei`);
    console.log(formatDecodedSwap(decoded));

    // Skip sandwich if one is already in progress
    if (sandwichInProgress) {
      console.log("[BOT] ⏸️  Sandwich already in progress — skipping");
      return;
    }

    // Skip if victim is the bot itself (avoid self-sandwiching)
    if (tx.from.toLowerCase() === botAddress.toLowerCase()) {
      console.log("[BOT] Skipping own transaction");
      return;
    }

    // ── Execute sandwich ──────────────────────────────────────────────────
    sandwichInProgress = true;
    stats.sandwichesAttempted++;

    console.log("[BOT] 🥪 Executing sandwich...");

    try {
      const result = await executeSandwich(tx, decoded, config);

      if (result.profitable && result.frontRunHash) {
        stats.sandwichesSucceeded++;
        if (result.estimatedProfit) {
          stats.totalProfit += result.estimatedProfit;
        }

        console.log("[BOT] ✅ SANDWICH COMPLETE");
        if (result.frontRunHash) console.log(`  Front-run: ${result.frontRunHash}`);
        if (result.backRunHash)  console.log(`  Back-run:  ${result.backRunHash}`);
        if (result.estimatedProfit) {
          console.log(`  Est. profit: ${ethers.formatUnits(result.estimatedProfit, 18)} tokens`);
        }
        console.log(`  Total profit this session: ${ethers.formatUnits(stats.totalProfit, 18)} tokens`);
      } else {
        console.log(`[BOT] ℹ️  Sandwich skipped: ${result.reason}`);
      }
    } catch (err) {
      console.error("[BOT] ❌ Sandwich error:", String(err));
    } finally {
      sandwichInProgress = false;
    }

    console.log("━".repeat(55));
  }

  // ── Subscribe to pending transactions ─────────────────────────────────────
  // Method 1: eth_subscribe (WebSocket) — preferred
  if (provider instanceof ethers.WebSocketProvider) {
    provider.on("pending", (txHash: string) => {
      processPendingTx(txHash).catch(() => {});
    });
    console.log("[BOT] Subscribed via eth_subscribe newPendingTransactions");
  } else {
    // Method 2: Polling fallback — poll txpool every 200ms
    console.log("[BOT] Using polling fallback (200ms interval)");

    async function pollMempool() {
      try {
        // eth_getBlockByNumber("pending") returns pending txs on Anvil
        const pendingBlock = await provider.send("eth_getBlockByNumber", ["pending", false]);
        if (pendingBlock?.transactions) {
          for (const txHash of pendingBlock.transactions) {
            processPendingTx(txHash).catch(() => {});
          }
        }
      } catch {
        // ignore polling errors
      }
    }

    setInterval(pollMempool, 200);
  }

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  process.on("SIGINT", () => {
    console.log("\n[BOT] Shutting down...");
    console.log(`[BOT] Final stats:`);
    console.log(`  Transactions scanned: ${stats.scanned}`);
    console.log(`  Swaps detected:       ${stats.swapsDetected}`);
    console.log(`  Sandwiches attempted: ${stats.sandwichesAttempted}`);
    console.log(`  Sandwiches succeeded: ${stats.sandwichesSucceeded}`);
    console.log(`  Total profit:         ${ethers.formatUnits(stats.totalProfit, 18)} tokens`);
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[BOT] Fatal error:", err);
  process.exit(1);
});

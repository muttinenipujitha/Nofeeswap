// bot/src/sandwich.ts
// Executes a sandwich attack against a detected victim swap.
//
// Strategy:
//   1. Front-run:  Buy token0 with higher gas → mines BEFORE victim
//   2. Victim:     Their swap executes at a worse price (we don't submit this)
//   3. Back-run:   Sell token0 with lower gas → mines AFTER victim
//
// On Anvil with --no-mining, we use anvil_mine to control block ordering.
// In a real network, priority fees (EIP-1559) control ordering.

import { ethers } from "ethers";
import { DecodedSwap } from "./decoder";

const OPERATOR_ABI = [
  "function swap(uint256 poolId, bool zeroForOne, int256 amountSpecified, uint256 sqrtPriceLimitX96, bytes hookData) returns (int256 amount0, int256 amount1)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

export interface SandwichConfig {
  provider: ethers.JsonRpcProvider;
  botWallet: ethers.Wallet;
  operatorAddress: string;
  token0Address: string;
  token1Address: string;
}

export interface SandwichResult {
  profitable: boolean;
  frontRunHash?: string;
  backRunHash?: string;
  estimatedProfit?: bigint;
  reason?: string;
}

/**
 * Profitability check before executing.
 * 
 * Simplified model (constant-product):
 *   frontRunOut  ≈ L * sqrtP * amtFront / (L + amtFront * sqrtP)
 *   priceAfterFR = sqrtP * (1 + amtFront/L)^2
 *   victimOut    ≈ L * priceAfterFR_sqrt * amtVictim / (L + amtVictim * priceAfterFR_sqrt)
 *   backRunOut   ≈ pool.buy(frontRunOut tokens)
 *   profit       = backRunOut - frontRunIn - gasCost
 */
function estimateProfit(
  victimAmountIn: bigint,
  sqrtPriceX96: bigint,
  liquidity: bigint,
  gasCostWei: bigint,
  frontRunFraction = 0.5  // We front-run with 50% of victim's size
): { profitable: boolean; estimatedProfit: bigint; frontRunAmount: bigint } {
  const Q96 = 2n ** 96n;
  const sqrtP = Number(sqrtPriceX96) / Number(Q96);
  const L = Number(liquidity) / 1e18;
  const victimAmt = Number(victimAmountIn) / 1e18;
  const frontRunAmt = victimAmt * frontRunFraction;

  // Front-run: buy token0 (zeroForOne = false means buying token0 with token1)
  const frontRunOut = (L * sqrtP * frontRunAmt) / (L + frontRunAmt * sqrtP);

  // Price after front-run
  const sqrtPAfterFR = sqrtP + frontRunAmt / L;

  // Back-run: sell the token0 we bought
  const backRunOut = L * (1/sqrtP - 1/sqrtPAfterFR) * 0.997; // 0.3% fee approx

  const profitEth = Math.max(0, backRunOut - frontRunAmt);
  const profitWei = BigInt(Math.floor(profitEth * 1e18));
  const netProfit = profitWei - gasCostWei;

  return {
    profitable: netProfit > 0n,
    estimatedProfit: netProfit,
    frontRunAmount: BigInt(Math.floor(frontRunAmt * 1e18)),
  };
}

export async function executeSandwich(
  victimTx: ethers.TransactionResponse,
  decodedSwap: DecodedSwap,
  config: SandwichConfig
): Promise<SandwichResult> {
  const { provider, botWallet, operatorAddress, token0Address, token1Address } = config;

  const operator = new ethers.Contract(operatorAddress, OPERATOR_ABI, botWallet);

  // ── 1. Profitability check ────────────────────────────────────────────────
  const MOCK_SQRT_PRICE = 2n ** 96n; // 1:1 price (replace with live pool read)
  const MOCK_LIQUIDITY = 1_000_000n * 10n ** 18n;
  const GAS_COST_WEI = 500_000n * 2_000_000_000n; // 500k gas @ 2 gwei

  const { profitable, estimatedProfit, frontRunAmount } = estimateProfit(
    decodedSwap.amountSpecified < 0n ? -decodedSwap.amountSpecified : decodedSwap.amountSpecified,
    MOCK_SQRT_PRICE,
    MOCK_LIQUIDITY,
    GAS_COST_WEI
  );

  if (!profitable) {
    return {
      profitable: false,
      reason: `Not profitable. Estimated P&L: ${ethers.formatUnits(estimatedProfit, 18)} ETH after gas`,
    };
  }

  console.log(`  [BOT] Estimated profit: ${ethers.formatUnits(estimatedProfit, 18)} ETH`);
  console.log(`  [BOT] Front-run amount: ${ethers.formatUnits(frontRunAmount, 18)} tokens`);

  // ── 2. Get bot's current nonce ────────────────────────────────────────────
  const botNonce = await provider.getTransactionCount(botWallet.address, "pending");

  // Victim gas price (legacy or EIP-1559)
  const victimGasPrice = victimTx.gasPrice ?? victimTx.maxFeePerGas ?? 1_000_000_000n;

  // Front-run: higher gas price to jump ahead of victim
  const frontRunGasPrice = (victimGasPrice * 115n) / 100n; // +15%

  // Back-run: lower gas price to mine after victim
  const backRunGasPrice = (victimGasPrice * 90n) / 100n; // -10%

  // ── 3. Build & send front-run transaction ─────────────────────────────────
  console.log("  [BOT] 🟢 Submitting FRONT-RUN...");

  const Q96 = 2n ** 96n;
  // For front-run: we buy in the opposite direction of victim
  // If victim is zeroForOne, we front-run by buying (zeroForOne = false)
  const frontRunZeroForOne = !decodedSwap.zeroForOne;
  const frontRunSlippage = decodedSwap.sqrtPriceLimitX96; // permissive limit

  let frontRunHash: string | undefined;
  try {
    const frontRunTx = await operator.swap(
      decodedSwap.poolId,
      frontRunZeroForOne,
      frontRunAmount,
      frontRunZeroForOne
        ? (MOCK_SQRT_PRICE * 120n) / 100n   // upper bound: accept up to +20% price move
        : (MOCK_SQRT_PRICE * 80n) / 100n,   // lower bound: accept down to -20%
      "0x",
      {
        nonce: botNonce,
        gasPrice: frontRunGasPrice,
        gasLimit: 300_000n,
      }
    );
    frontRunHash = frontRunTx.hash;
    console.log(`  [BOT] Front-run submitted: ${frontRunHash}`);

    // Mine 1 block: front-run executes here
    await provider.send("anvil_mine", [1]);
    console.log("  [BOT] ⛏️  Block mined — front-run confirmed");

    // Wait for front-run receipt
    const frReceipt = await frontRunTx.wait(1);
    if (!frReceipt || frReceipt.status === 0) {
      return { profitable: true, frontRunHash, reason: "Front-run reverted" };
    }
  } catch (err) {
    return { profitable: true, reason: `Front-run failed: ${String(err)}` };
  }

  // ── 4. Let victim's transaction mine ──────────────────────────────────────
  // The victim's tx was already in the mempool with its original gas price.
  // Mining a block now causes it to be included.
  console.log("  [BOT] 🟡 Mining victim's transaction...");
  await provider.send("anvil_mine", [1]);
  console.log("  [BOT] ⛏️  Block mined — victim swap confirmed (at worse price)");

  // ── 5. Build & send back-run transaction ──────────────────────────────────
  // Sell what we bought in the front-run
  console.log("  [BOT] 🔴 Submitting BACK-RUN...");

  let backRunHash: string | undefined;
  try {
    const backRunZeroForOne = decodedSwap.zeroForOne; // sell in same direction as victim originally
    const backRunTx = await operator.swap(
      decodedSwap.poolId,
      backRunZeroForOne,
      frontRunAmount, // sell the exact amount we bought
      backRunZeroForOne
        ? (MOCK_SQRT_PRICE * 70n) / 100n   // permissive lower bound
        : (MOCK_SQRT_PRICE * 130n) / 100n, // permissive upper bound
      "0x",
      {
        nonce: botNonce + 1,
        gasPrice: backRunGasPrice,
        gasLimit: 300_000n,
      }
    );
    backRunHash = backRunTx.hash;
    console.log(`  [BOT] Back-run submitted: ${backRunHash}`);

    // Mine final block
    await provider.send("anvil_mine", [1]);
    console.log("  [BOT] ⛏️  Block mined — back-run confirmed");

    await backRunTx.wait(1);
  } catch (err) {
    return {
      profitable: true,
      frontRunHash,
      reason: `Back-run failed: ${String(err)}`,
      estimatedProfit,
    };
  }

  console.log("  [BOT] ✅ Sandwich complete!");

  return {
    profitable: true,
    frontRunHash,
    backRunHash,
    estimatedProfit,
  };
}

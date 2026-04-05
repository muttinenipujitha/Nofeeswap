// src/utils/math.ts
// NoFeeSwap-specific math helpers (integer arithmetic, no floats in EVM paths)

const Q96 = BigInt(2) ** BigInt(96);
const Q128 = BigInt(2) ** BigInt(128);

/**
 * Convert a human-readable price (token1 per token0) to sqrtPriceX96
 * used by NoFeeSwap / Uniswap V3-style pools.
 *
 * sqrtPriceX96 = sqrt(price) * 2^96
 */
export function priceToSqrtPriceX96(price: number): bigint {
  // Use floating-point sqrt then convert to bigint
  const sqrtPrice = Math.sqrt(price);
  return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

/**
 * Convert sqrtPriceX96 to a human-readable price.
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  return sqrtPrice * sqrtPrice;
}

/**
 * Apply slippage to a sqrtPriceX96 value.
 * For a buy (zeroForOne = false), the price limit is sqrtPrice * (1 + slippage)
 * For a sell (zeroForOne = true),  the price limit is sqrtPrice * (1 - slippage)
 *
 * @param sqrtPriceX96 - current pool sqrtPriceX96
 * @param slippageBps  - slippage in basis points (e.g., 50 = 0.5%)
 * @param zeroForOne   - direction of the swap
 */
export function applySlippage(
  sqrtPriceX96: bigint,
  slippageBps: number,
  zeroForOne: boolean
): bigint {
  const bps = BigInt(10000);
  const slip = BigInt(slippageBps);
  if (zeroForOne) {
    // Selling token0: price falls → lower limit
    return (sqrtPriceX96 * (bps - slip)) / bps;
  } else {
    // Buying token0: price rises → upper limit
    return (sqrtPriceX96 * (bps + slip)) / bps;
  }
}

/**
 * Estimate price impact of a swap given pool liquidity.
 * Returns price impact as a percentage (0-100).
 *
 * Simplified model: ΔP/P ≈ amountIn / (2 * L * sqrtP) for small trades
 */
export function estimatePriceImpact(
  amountIn: bigint,
  sqrtPriceX96: bigint,
  liquidity: bigint
): number {
  if (liquidity === 0n) return 0;
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const impact = Number(amountIn) / (2 * Number(liquidity) * sqrtPrice);
  return Math.min(impact * 100, 99.9);
}

/**
 * Estimate output amount for a swap (constant-product approximation).
 * This is a rough estimate — the exact amount depends on the kernel shape.
 *
 * amountOut ≈ amountIn * sqrtPrice^2 / (1 + amountIn / L * sqrtPrice)
 */
export function estimateAmountOut(
  amountIn: bigint,
  sqrtPriceX96: bigint,
  liquidity: bigint,
  zeroForOne: boolean
): bigint {
  if (liquidity === 0n || amountIn === 0n) return 0n;
  const sqrtP = Number(sqrtPriceX96) / Number(Q96);
  const L = Number(liquidity);
  const amtIn = Number(amountIn) / 1e18;

  let amtOut: number;
  if (zeroForOne) {
    // Selling token0, getting token1: out = L * (sqrtP - sqrtP_new)
    const sqrtPNew = (L * sqrtP) / (L + amtIn * sqrtP);
    amtOut = L * (sqrtP - sqrtPNew);
  } else {
    // Selling token1, getting token0: out = L * (1/sqrtP_new - 1/sqrtP)
    const sqrtPNew = sqrtP + amtIn / L;
    amtOut = L * (1 / sqrtP - 1 / sqrtPNew);
  }
  return BigInt(Math.floor(Math.max(amtOut, 0) * 1e18));
}

/**
 * Format a bigint token amount with decimals for display.
 */
export function formatTokenAmount(amount: bigint, decimals = 18, precision = 6): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, precision);
  return `${whole}.${fracStr}`;
}

/**
 * Parse a human-readable token amount to bigint with decimals.
 */
export function parseTokenAmount(amount: string, decimals = 18): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole || "0") * BigInt(10 ** decimals) + BigInt(fracPadded || "0");
}

/**
 * NoFeeSwap Pool ID encoding.
 * PoolId is derived from token0, token1, fee tier, and hook address.
 * Simplified version — exact encoding from NoFeeSwap YellowPaper §3.
 *
 * The actual poolId used on-chain is computed by the contracts.
 * This helper generates a deterministic local ID for UI purposes.
 */
export function encodePoolId(
  token0: `0x${string}`,
  token1: `0x${string}`,
  feeTier: number,
  hookAddress: `0x${string}` = "0x0000000000000000000000000000000000000000"
): bigint {
  // Pack: token0 (160 bits) | token1 (160 bits) | fee (24 bits) | hook (160 bits)
  // Truncated to 256 bits for the poolId slot
  const t0 = BigInt(token0);
  const t1 = BigInt(token1);
  const fee = BigInt(feeTier);
  const hook = BigInt(hookAddress);

  // Simple keccak-style mix using arithmetic (UI only, not EVM keccak)
  return (t0 << 96n) ^ (t1 << 32n) ^ fee ^ (hook >> 128n);
}

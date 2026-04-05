// bot/src/decoder.ts
// Decodes NoFeeSwap Operator swap() calldata to extract victim's trade parameters.

import { ethers } from "ethers";

// NoFeeSwap Operator swap() ABI fragment
// function swap(uint256 poolId, bool zeroForOne, int256 amountSpecified, uint256 sqrtPriceLimitX96, bytes hookData)
const SWAP_ABI = [
  "function swap(uint256 poolId, bool zeroForOne, int256 amountSpecified, uint256 sqrtPriceLimitX96, bytes hookData)",
];

const iface = new ethers.Interface(SWAP_ABI);

// Function selector for swap()
export const SWAP_SELECTOR = iface.getFunction("swap")!.selector;

export interface DecodedSwap {
  poolId: bigint;
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
  hookData: string;
  // Derived fields
  isExactIn: boolean;
  slippageBps: number;
}

/**
 * Decode a swap() calldata and extract trading parameters.
 * Returns null if the calldata is not a valid swap() call.
 */
export function decodeSwapCalldata(calldata: string): DecodedSwap | null {
  try {
    // Check function selector
    if (!calldata.startsWith(SWAP_SELECTOR)) {
      return null;
    }

    const decoded = iface.decodeFunctionData("swap", calldata);

    const poolId = decoded[0] as bigint;
    const zeroForOne = decoded[1] as boolean;
    const amountSpecified = decoded[2] as bigint;
    const sqrtPriceLimitX96 = decoded[3] as bigint;
    const hookData = decoded[4] as string;

    // amountSpecified > 0 = exact input, < 0 = exact output
    const isExactIn = amountSpecified > 0n;

    // Reverse-engineer slippage from sqrtPriceLimitX96
    // We compare the limit to the "current" price — approximated here
    // In production: fetch pool state and compute exact slippage
    const slippageBps = estimateSlippageBps(sqrtPriceLimitX96, zeroForOne);

    return {
      poolId,
      zeroForOne,
      amountSpecified,
      sqrtPriceLimitX96,
      hookData,
      isExactIn,
      slippageBps,
    };
  } catch {
    return null;
  }
}

/**
 * Estimate slippage tolerance in basis points from sqrtPriceLimitX96.
 * 
 * The victim sets sqrtPriceLimitX96 = currentSqrtPrice * (1 ± slippage)
 * We approximate by comparing to the Q96 midpoint.
 * 
 * In a production bot, this would fetch the live pool sqrtPrice from
 * contract state and compute the exact delta.
 */
function estimateSlippageBps(sqrtPriceLimitX96: bigint, zeroForOne: boolean): number {
  const Q96 = 2n ** 96n;
  
  // Approximate "1:1 price" sqrtPrice = 1 * Q96
  const neutralSqrtPrice = Q96;

  if (zeroForOne) {
    // Selling token0: limit is lower bound. Slippage = 1 - limit/neutral
    if (sqrtPriceLimitX96 >= neutralSqrtPrice) return 0;
    const ratio = (neutralSqrtPrice - sqrtPriceLimitX96) * 10000n / neutralSqrtPrice;
    return Number(ratio);
  } else {
    // Buying token0: limit is upper bound. Slippage = limit/neutral - 1
    if (sqrtPriceLimitX96 <= neutralSqrtPrice) return 0;
    const ratio = (sqrtPriceLimitX96 - neutralSqrtPrice) * 10000n / neutralSqrtPrice;
    return Number(ratio);
  }
}

/**
 * Pretty-print a decoded swap for logging.
 */
export function formatDecodedSwap(swap: DecodedSwap): string {
  const direction = swap.zeroForOne ? "Token0 → Token1" : "Token1 → Token0";
  const kind = swap.isExactIn ? "exact-in" : "exact-out";
  const amount = ethers.formatUnits(
    swap.amountSpecified < 0n ? -swap.amountSpecified : swap.amountSpecified,
    18
  );

  return [
    `  Direction:    ${direction}`,
    `  Kind:         ${kind}`,
    `  Amount:       ${amount} tokens`,
    `  Slippage:     ~${(swap.slippageBps / 100).toFixed(2)}%`,
    `  SqrtLimit:    ${swap.sqrtPriceLimitX96.toString().slice(0, 20)}...`,
    `  PoolId:       ${swap.poolId.toString(16).slice(0, 12)}...`,
  ].join("\n");
}

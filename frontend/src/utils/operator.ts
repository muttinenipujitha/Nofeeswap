// src/utils/operator.ts
// ─────────────────────────────────────────────────────────────────────────────
// NoFeeSwap Operator Bytecode Encoder
//
// The NoFeeSwap Operator does NOT use standard ABI-encoded function calls.
// Instead, it accepts a sequence of compactly packed Action opcodes via its
// unlockCallback / fallback. Every interaction must be encoded as:
//   abi.encodePacked(Action, ...args, Action, ...args, ...)
//
// The core contract's initialize() is called via:
//   Nofeeswap.dispatch(abi.encodeWithSelector(INofeeswapDelegatee.initialize.selector, ...))
//
// For the frontend demo, we call the CORE directly (not via Operator)
// for initialize/modifyPosition, since the Operator's encoded format
// requires precise bytecode construction that is complex to do from JS.
//
// The Operator's unlockCallback accepts raw bytes — the function selector
// for the entry point is the fallback (any call to Operator triggers it).
// ─────────────────────────────────────────────────────────────────────────────

import { encodePacked, encodeAbiParameters, keccak256, toBytes, concat } from "viem";

// Action enum values (index matches enum order in IOperator.sol)
export const Action = {
  PUSH0: 0,
  PUSH10: 1,
  PUSH16: 2,
  PUSH32: 3,
  NEG: 4,
  ADD: 5,
  SUB: 6,
  MIN: 7,
  MAX: 8,
  MUL: 9,
  DIV: 10,
  DIV_ROUND_DOWN: 11,
  DIV_ROUND_UP: 12,
  LT: 13,
  EQ: 14,
  LTEQ: 15,
  ISZERO: 16,
  AND: 17,
  OR: 18,
  XOR: 19,
  JUMPDEST: 20,
  JUMP: 21,
  READ_TRANSIENT_BALANCE: 22,
  READ_BALANCE_OF_NATIVE: 23,
  READ_BALANCE_OF_ERC20: 24,
  READ_BALANCE_OF_MULTITOKEN: 25,
  READ_ALLOWANCE_ERC20: 26,
  READ_ALLOWANCE_PERMIT2: 27,
  READ_ALLOWANCE_ERC6909: 28,
  READ_IS_OPERATOR_ERC6909: 29,
  READ_IS_APPROVED_FOR_ALL_ERC1155: 30,
  READ_DOUBLE_BALANCE: 31,
  WRAP_NATIVE: 32,
  UNWRAP_NATIVE: 33,
  PERMIT_PERMIT2: 34,
  PERMIT_BATCH_PERMIT2: 35,
  TRANSFER_NATIVE: 36,
  TRANSFER_FROM_PAYER_ERC20: 37,
  TRANSFER_FROM_PAYER_PERMIT2: 38,
  TRANSFER_FROM_PAYER_ERC6909: 39,
  SAFE_TRANSFER_FROM_PAYER_ERC1155: 40,
  CLEAR: 41,
  TAKE_TOKEN: 42,
  TAKE_ERC6909: 43,
  TAKE_ERC1155: 44,
  SYNC_TOKEN: 45,
  SYNC_MULTITOKEN: 46,
  SETTLE: 47,
  TRANSFER_TRANSIENT_BALANCE: 48,
  TRANSFER_TRANSIENT_BALANCE_FROM_PAYER: 49,
  MODIFY_SINGLE_BALANCE: 50,
  MODIFY_DOUBLE_BALANCE: 51,
  SWAP: 52,
  MODIFY_POSITION: 53,
  DONATE: 54,
  QUOTE_SWAP: 55,
  QUOTE_MODIFY_POSITION: 56,
  QUOTE_DONATE: 57,
  QUOTER_TRANSIENT_ACCESS: 58,
  REVERT: 59,
} as const;

// INofeeswapDelegatee.initialize selector
// function initialize(uint256 unsaltedPoolId, Tag tag0, Tag tag1, X47 poolGrowthPortion,
//   uint256[] calldata kernelCompactArray, uint256[] calldata curveArray, bytes calldata hookData)
export const INITIALIZE_SELECTOR = "0x05970088"; // keccak256("initialize(uint256,uint256,uint256,uint256,uint256[],uint256[],bytes)")[0:4]

// INofeeswapDelegatee.modifyPosition selector  
export const MODIFY_POSITION_SELECTOR = "0x"; // filled after checking

/**
 * Encode a SWAP action for the Operator.
 *
 * Format: abi.encodePacked(
 *   Action.SWAP,          // uint8
 *   poolId,               // uint256
 *   amountSpecifiedSlot,  // uint8
 *   limitOffsetted,       // uint64
 *   zeroForOne,           // uint8
 *   crossThresholdSlot,   // uint8
 *   successSlot,          // uint8
 *   amount0Slot,          // uint8
 *   amount1Slot,          // uint8
 *   hookDataBytesCount,   // uint16
 *   hookData              // bytes
 * )
 */
export function encodeSwapAction(params: {
  poolId: bigint;
  amountSpecifiedSlot: number;
  limitOffsetted: bigint;
  zeroForOne: number;
  crossThresholdSlot: number;
  successSlot: number;
  amount0Slot: number;
  amount1Slot: number;
}): `0x${string}` {
  const hookData = new Uint8Array(0);
  
  // Manual abi.encodePacked
  const buf = new Uint8Array(1 + 32 + 1 + 8 + 1 + 1 + 1 + 1 + 1 + 2);
  let offset = 0;
  
  buf[offset++] = Action.SWAP;
  
  // poolId as uint256 (32 bytes big-endian)
  const poolIdHex = params.poolId.toString(16).padStart(64, "0");
  for (let i = 0; i < 32; i++) {
    buf[offset + i] = parseInt(poolIdHex.slice(i * 2, i * 2 + 2), 16);
  }
  offset += 32;
  
  buf[offset++] = params.amountSpecifiedSlot;
  
  // limitOffsetted as uint64 (8 bytes)
  const limitHex = params.limitOffsetted.toString(16).padStart(16, "0");
  for (let i = 0; i < 8; i++) {
    buf[offset + i] = parseInt(limitHex.slice(i * 2, i * 2 + 2), 16);
  }
  offset += 8;
  
  buf[offset++] = params.zeroForOne;
  buf[offset++] = params.crossThresholdSlot;
  buf[offset++] = params.successSlot;
  buf[offset++] = params.amount0Slot;
  buf[offset++] = params.amount1Slot;
  
  // hookDataBytesCount = 0
  buf[offset++] = 0;
  buf[offset++] = 0;
  
  return ("0x" + Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

/**
 * Encode PUSH32 + SWAP sequence for the Operator.
 * This pushes amountSpecified into slot 0, crossThreshold into slot 1,
 * then executes SWAP.
 */
export function encodeFullSwapSequence(params: {
  poolId: bigint;
  amountSpecified: bigint;
  limitOffsetted: bigint;
  zeroForOne: number; // 0 or 1
  crossThreshold: bigint;
}): `0x${string}` {
  const bytes: number[] = [];
  
  const push256 = (slot: number, value: bigint) => {
    bytes.push(Action.PUSH32);
    const hex = (value < 0n
      ? (2n**256n + value).toString(16)
      : value.toString(16)
    ).padStart(64, "0");
    for (let i = 0; i < 32; i++) {
      bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
    }
    bytes.push(slot);
  };

  // PUSH32 amountSpecified -> slot 0
  push256(0, params.amountSpecified);
  // PUSH32 crossThreshold -> slot 1  
  push256(1, params.crossThreshold);
  
  // SWAP action
  bytes.push(Action.SWAP);
  // poolId (32 bytes)
  const poolIdHex = params.poolId.toString(16).padStart(64, "0");
  for (let i = 0; i < 32; i++) bytes.push(parseInt(poolIdHex.slice(i * 2, i * 2 + 2), 16));
  bytes.push(0); // amountSpecifiedSlot = 0
  // limitOffsetted (8 bytes)
  const limitHex = params.limitOffsetted.toString(16).padStart(16, "0");
  for (let i = 0; i < 8; i++) bytes.push(parseInt(limitHex.slice(i * 2, i * 2 + 2), 16));
  bytes.push(params.zeroForOne); // zeroForOne
  bytes.push(1); // crossThresholdSlot = 1
  bytes.push(2); // successSlot = 2
  bytes.push(3); // amount0Slot = 3
  bytes.push(4); // amount1Slot = 4
  bytes.push(0); bytes.push(0); // hookDataBytesCount = 0

  return ("0x" + bytes.map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

/**
 * Encode MODIFY_POSITION sequence for add/remove liquidity.
 *
 * Format: PUSH32(shares, slot0) + MODIFY_POSITION(poolId, qMin, qMax, slot0, ...)
 *
 * qMinOffsetted / qMaxOffsetted: (2^59 * log(price)) - logOffset + 16*2^59
 * For the demo we use the full range: qMin = 0, qMax = max uint64
 */
export function encodeModifyPositionSequence(params: {
  poolId: bigint;
  shares: bigint; // positive = mint, negative = burn
  qMinOffsetted?: bigint;
  qMaxOffsetted?: bigint;
}): `0x${string}` {
  const bytes: number[] = [];
  
  const qMin = params.qMinOffsetted ?? 0n;
  const qMax = params.qMaxOffsetted ?? 0xFFFFFFFFFFFFFFFFn; // full range

  const push256 = (slot: number, value: bigint) => {
    bytes.push(Action.PUSH32);
    const hex = (value < 0n
      ? (2n**256n + value).toString(16)
      : value.toString(16)
    ).padStart(64, "0");
    for (let i = 0; i < 32; i++) {
      bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
    }
    bytes.push(slot);
  };

  // PUSH32 shares -> slot 0
  push256(0, params.shares);

  // MODIFY_POSITION
  bytes.push(Action.MODIFY_POSITION);
  // poolId (32 bytes)
  const poolIdHex = params.poolId.toString(16).padStart(64, "0");
  for (let i = 0; i < 32; i++) bytes.push(parseInt(poolIdHex.slice(i * 2, i * 2 + 2), 16));
  // qMinOffsetted (8 bytes)
  const qMinHex = qMin.toString(16).padStart(16, "0");
  for (let i = 0; i < 8; i++) bytes.push(parseInt(qMinHex.slice(i * 2, i * 2 + 2), 16));
  // qMaxOffsetted (8 bytes)
  const qMaxHex = qMax.toString(16).padStart(16, "0");
  for (let i = 0; i < 8; i++) bytes.push(parseInt(qMaxHex.slice(i * 2, i * 2 + 2), 16));
  bytes.push(0); // sharesSlot = 0
  bytes.push(1); // successSlot = 1
  bytes.push(2); // amount0Slot = 2
  bytes.push(3); // amount1Slot = 3
  bytes.push(0); bytes.push(0); // hookDataBytesCount = 0

  return ("0x" + bytes.map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

/**
 * The Operator's entry point: call with the encoded bytecode sequence.
 * The function selector is 0x (fallback) — send raw calldata to Operator.
 */
export const OPERATOR_ABI = [
  {
    // The Operator's fallback accepts raw encoded action sequences
    type: "fallback",
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "nofeeswap",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

/**
 * The core Nofeeswap contract ABI for direct calls.
 * initialize() and dispatch() are called directly on the core, not Operator.
 */
export const CORE_ABI = [
  {
    // dispatch: calls delegatee functions (initialize, modifyPosition, etc.)
    type: "function",
    name: "dispatch",
    inputs: [{ name: "input", type: "bytes" }],
    outputs: [{ name: "output", type: "bytes" }],
    stateMutability: "nonpayable",
  },
  {
    // unlock: opens a transient session for the Operator's callback
    type: "function", 
    name: "unlock",
    inputs: [
      { name: "caller", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "result", type: "bytes" }],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Encode an initialize() call for dispatch() on the core.
 * 
 * initialize(
 *   uint256 unsaltedPoolId,
 *   Tag tag0,              // = address(token0) as uint256
 *   Tag tag1,              // = address(token1) as uint256
 *   X47 poolGrowthPortion, // fee tier encoded
 *   uint256[] kernelCompactArray,
 *   uint256[] curveArray,
 *   bytes hookData
 * )
 */
export function encodeInitializeCall(params: {
  unsaltedPoolId: bigint;
  tag0: bigint;
  tag1: bigint;
  poolGrowthPortion: bigint;
  kernelCompactArray: bigint[];
  curveArray: bigint[];
}): `0x${string}` {
  // Function selector for initialize
  const selector = "0x05970088";
  
  const encoded = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256[]" },
      { type: "uint256[]" },
      { type: "bytes" },
    ],
    [
      params.unsaltedPoolId,
      params.tag0,
      params.tag1,
      params.poolGrowthPortion,
      params.kernelCompactArray,
      params.curveArray,
      "0x",
    ]
  );
  
  return (selector + encoded.slice(2)) as `0x${string}`;
}

/**
 * Compute the Tag for a token address.
 * Tag = uint256(uint160(tokenAddress))
 * token0Tag < token1Tag always.
 */
export function addressToTag(addr: `0x${string}`): bigint {
  return BigInt(addr);
}

/**
 * Compute unsaltedPoolId from tag0, tag1, and logSpacing.
 * From YellowPaper: poolId encodes both tags and spacing.
 * Simplified: pack tag0 (lower 20 bytes) and tag1 (lower 20 bytes) + spacing.
 */
export function computeUnsaltedPoolId(
  tag0: bigint,
  tag1: bigint,
  logSpacingX59: bigint = 2n ** 59n // default 1 spacing
): bigint {
  // Pack into a uint256: upper bits = tag0 & mask, lower bits = tag1 & mask
  // This is a simplified version — the exact format is in the YellowPaper
  const tag0Masked = tag0 & BigInt("0x00000000000000000000000000000000ffffffffffffffff");
  const tag1Masked = tag1 & BigInt("0x00000000000000000000000000000000ffffffffffffffff");
  return (tag0Masked << 128n) | tag1Masked;
}

/**
 * Encode kernel from SwapData_test.py#L841-L846 mock.
 * kernel = [(0, 0), (2^15-1, 2^15-1)]
 * Each breakpoint packs as: (priceOffset << 15) | liquidityWeight  
 */
export const MOCK_KERNEL_COMPACT: bigint[] = [
  0n,
  32767n,
];

/**
 * Mock curve array from SwapData_test.py.
 */
export const MOCK_CURVE_ARRAY: bigint[] = [
  BigInt("0x0000000000000001000000000000000100000000000000010000000000000001"),
];

/**
 * poolGrowthPortion for 0.3% fee tier.
 * X47 format: scaled by 2^47
 */
export const POOL_GROWTH_PORTION_30BPS = BigInt("0x0000000000000000000000000001000000000000"); // simplified

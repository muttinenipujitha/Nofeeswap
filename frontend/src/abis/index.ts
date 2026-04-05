// src/abis/index.ts
// Correct ABIs based on actual NoFeeSwap contract source inspection

export const NOFEESWAP_CORE_ABI = [
  // dispatch: calls delegatee via delegatecall (initialize, modifyPosition etc.)
  {
    type: "function",
    name: "dispatch",
    inputs: [{ name: "input", type: "bytes" }],
    outputs: [{ name: "output", type: "bytes" }],
    stateMutability: "nonpayable",
  },
  // unlock: opens transient session
  {
    type: "function",
    name: "unlock",
    inputs: [
      { name: "caller", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "result", type: "bytes" }],
    stateMutability: "nonpayable",
  },
  // storageAccess: read pool state
  {
    type: "function",
    name: "storageAccess",
    inputs: [{ name: "slot", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  // ERC6909 balance (NoFeeSwap uses ERC6909 for pool shares)
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      { name: "owner", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// The Operator accepts raw packed action bytes via its fallback.
// For standard interaction, we encode action sequences manually.
export const NOFEESWAP_OPERATOR_ABI = [
  {
    // Entry point: send packed action bytes as calldata
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
  {
    type: "function",
    name: "quoter",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

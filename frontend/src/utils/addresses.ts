// src/utils/addresses.ts
// ─────────────────────────────────────────────────────────────────────────────
// After running the deployment scripts, update these addresses from the
// deployment-*.json files generated in the contracts/ directory.
// ─────────────────────────────────────────────────────────────────────────────

export const ADDRESSES = {
  NOFEESWAP_CORE: (process.env.NEXT_PUBLIC_NOFEESWAP_CORE ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  NOFEESWAP_OPERATOR: (process.env.NEXT_PUBLIC_NOFEESWAP_OPERATOR ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  TOKEN_ALPHA: (process.env.NEXT_PUBLIC_TOKEN_ALPHA ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,

  TOKEN_BETA: (process.env.NEXT_PUBLIC_TOKEN_BETA ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;

// Canonical ordering: token0 address < token1 address
export function getCanonicalTokenOrder(
  addrA: `0x${string}`,
  addrB: `0x${string}`
): [`0x${string}`, `0x${string}`] {
  return addrA.toLowerCase() < addrB.toLowerCase()
    ? [addrA, addrB]
    : [addrB, addrA];
}

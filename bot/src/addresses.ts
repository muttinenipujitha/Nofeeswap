// bot/src/addresses.ts
// Update these after running forge deployment scripts.
// Values are read from .env at runtime; this file provides TypeScript types.

export const ADDRESSES = {
  NOFEESWAP_CORE:     process.env.NOFEESWAP_CORE     ?? "0x0000000000000000000000000000000000000000",
  NOFEESWAP_OPERATOR: process.env.NOFEESWAP_OPERATOR ?? "0x0000000000000000000000000000000000000000",
  TOKEN_ALPHA:        process.env.TOKEN_ALPHA         ?? "0x0000000000000000000000000000000000000000",
  TOKEN_BETA:         process.env.TOKEN_BETA          ?? "0x0000000000000000000000000000000000000000",
} as const;

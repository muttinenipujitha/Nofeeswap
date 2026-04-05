// src/lib/wagmi.ts
import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, metaMask } from "wagmi/connectors";

// Define local Anvil chain
export const anvil = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"],
    },
  },
  blockExplorers: {
    default: { name: "None", url: "" },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [anvil],
  connectors: [
    injected(),
    metaMask(),
  ],
  transports: {
    [anvil.id]: http(process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"),
  },
});

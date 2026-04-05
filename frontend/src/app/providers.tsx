"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/lib/wagmi";
import { Toaster } from "react-hot-toast";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#6366f1",
            accentColorForeground: "white",
            borderRadius: "medium",
          })}
        >
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1e1e2e",
                color: "#cdd6f4",
                border: "1px solid #313244",
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

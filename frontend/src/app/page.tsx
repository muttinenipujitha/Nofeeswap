"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { InitializePool } from "@/components/pool/InitializePool";
import { ManageLiquidity } from "@/components/liquidity/ManageLiquidity";
import { SwapInterface } from "@/components/swap/SwapInterface";
import { WalletStatus } from "@/components/wallet/WalletStatus";

const TABS = [
  { id: "swap", label: "🔄", fullLabel: "Swap" },
  { id: "pool", label: "🏊", fullLabel: "Initialize Pool" },
  { id: "liquidity", label: "💧", fullLabel: "Liquidity" },
];

function InfoRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-[#6c7086]">{label}</span>
      <span className={`text-[#cdd6f4] truncate max-w-[140px] ${mono ? "font-mono text-xs text-[#cba6f7]" : ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function shortenAddr(addr?: string): string {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return "Not set";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Home() {
  const [tab, setTab] = useState("swap");
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-[#1e1e2e] pb-12">
      {/* Header */}
      <header className="border-b border-[#313244] bg-[#181825] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#a6e3a1] flex items-center justify-center font-bold text-white shadow-lg shadow-[#6366f1]/20">
              N
            </div>
            <div>
              <span className="text-lg font-bold text-[#cdd6f4] tracking-tight">NoFeeSwap</span>
              <span className="ml-2 text-[10px] bg-[#313244] px-2 py-0.5 rounded-full text-[#6c7086] font-mono">
                localhost:8545
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-[#313244] rounded-lg px-3 py-1.5 text-xs text-[#6c7086]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f9e2af] animate-pulse" />
              Bot monitoring
            </div>
            <ConnectButton showBalance={false} chainStatus="icon" />
          </div>
        </div>

        {/* Tab nav */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${
                  tab === t.id
                    ? "border-[#6366f1] text-[#6366f1]"
                    : "border-transparent text-[#6c7086] hover:text-[#cdd6f4] hover:border-[#45475a]"
                }`}
              >
                <span className="sm:hidden">{t.label}</span>
                <span className="hidden sm:inline">{t.fullLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: main action */}
          <div className="lg:col-span-2">
            <div className="max-w-xl">
              {tab === "swap" && <SwapInterface />}
              {tab === "pool" && <InitializePool />}
              {tab === "liquidity" && <ManageLiquidity />}
            </div>
          </div>

          {/* Right: wallet + info */}
          <div className="space-y-4">
            <WalletStatus />

            <div className="dex-card space-y-3">
              <h3 className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">Protocol Info</h3>
              <div className="space-y-2 text-sm">
                <InfoRow label="Protocol" value="NoFeeSwap v1" />
                <InfoRow label="Network" value="Anvil Local (31337)" />
                <InfoRow label="Pair" value="ALPHA / BETA" />
                <InfoRow label="Core" value={shortenAddr(process.env.NEXT_PUBLIC_NOFEESWAP_CORE)} mono />
                <InfoRow label="Operator" value={shortenAddr(process.env.NEXT_PUBLIC_NOFEESWAP_OPERATOR)} mono />
              </div>
            </div>

            <div className="dex-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">Sandwich Bot</h3>
                <span className="flex items-center gap-1.5 text-xs text-[#f9e2af]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f9e2af] animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-xs text-[#6c7086] leading-relaxed">
                Monitors pending txs in the mempool. On swap detection, it decodes slippage + size and executes a sandwich if profitable.
              </p>
              <div className="bg-[#11111b] rounded-lg p-3 font-mono text-xs text-[#a6e3a1] space-y-1">
                <p className="text-[#6c7086]">$ cd bot && pnpm dev</p>
                <p>[BOT] Monitoring mempool...</p>
                <p className="text-[#f9e2af]">[BOT] 🎯 VICTIM SWAP DETECTED</p>
                <p>[BOT] 🥪 Executing sandwich...</p>
                <p>[BOT] ✅ SANDWICH COMPLETE</p>
              </div>
            </div>

            <div className="dex-card">
              <h3 className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider mb-3">Manual Mining</h3>
              <p className="text-xs text-[#6c7086] mb-2">
                Anvil runs with <code className="text-[#cba6f7] font-mono">--no-mining</code>. Mine manually or let the bot handle ordering.
              </p>
              <code className="block text-xs text-[#a6e3a1] font-mono bg-[#11111b] rounded-lg px-3 py-2">
                cast rpc anvil_mine 1 \<br/>
                &nbsp;&nbsp;--rpc-url http://127.0.0.1:8545
              </code>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-[#313244] bg-[#181825]/95 backdrop-blur-sm px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[#6c7086]">
          <span className="hidden sm:block">NoFeeSwap DEX · Technical Assessment Submission</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#a6e3a1] animate-pulse" />
              <span>Anvil · Chain 31337</span>
            </div>
            <span className="text-[#45475a]">|</span>
            <span>{isConnected ? "🟢 Connected" : "🔴 Disconnected"}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

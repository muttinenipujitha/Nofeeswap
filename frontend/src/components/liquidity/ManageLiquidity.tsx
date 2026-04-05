"use client";

import { useState } from "react";
import { useWriteContract, useAccount, useReadContract } from "wagmi";
import { NOFEESWAP_OPERATOR_ABI } from "@/abis";
import { ADDRESSES, getCanonicalTokenOrder } from "@/utils/addresses";
import { parseTokenAmount, formatTokenAmount } from "@/utils/math";
import { useTxStatus, TxStatusBadge } from "@/hooks/useTxStatus";

const POOL_ID = BigInt("0x1234abcd"); // Placeholder — set after pool init

export function ManageLiquidity() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<"mint" | "burn">("mint");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [shares, setShares] = useState("");
  const [burnPercent, setBurnPercent] = useState(100);

  const { writeContract: mintContract, data: mintHash, isPending: mintPending } = useWriteContract();
  const { writeContract: burnContract, data: burnHash, isPending: burnPending } = useWriteContract();

  const { status: mintStatus } = useTxStatus({ hash: mintHash, description: "Add Liquidity" });
  const { status: burnStatus } = useTxStatus({ hash: burnHash, description: "Remove Liquidity" });

  // Read user's current position shares
  const { data: positionShares } = useReadContract({
    address: ADDRESSES.NOFEESWAP_OPERATOR,
    abi: NOFEESWAP_OPERATOR_ABI,
    functionName: "positions",
    args: [POOL_ID, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  const userShares = positionShares as bigint | undefined;
  const displayShares = userShares ? formatTokenAmount(userShares < 0n ? -userShares : userShares, 0, 0) : "0";

  const handleMint = () => {
    if (!isConnected) return;
    const amt0 = parseTokenAmount(amount0 || "0");
    const amt1 = parseTokenAmount(amount1 || "0");
    const sharesToMint = parseTokenAmount(shares || "1000");

    mintContract({
      address: ADDRESSES.NOFEESWAP_OPERATOR,
      abi: NOFEESWAP_OPERATOR_ABI,
      functionName: "mint",
      args: [
        POOL_ID,
        sharesToMint,
        amt0,          // amount0Max
        amt1,          // amount1Max
        "0x",
      ],
    });
  };

  const handleBurn = () => {
    if (!isConnected || !userShares) return;
    const sharesToBurn = (userShares * BigInt(burnPercent)) / 100n;

    burnContract({
      address: ADDRESSES.NOFEESWAP_OPERATOR,
      abi: NOFEESWAP_OPERATOR_ABI,
      functionName: "burn",
      args: [
        POOL_ID,
        sharesToBurn,
        0n,   // amount0Min (0 = no slippage protection for demo)
        0n,   // amount1Min
        "0x",
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#cdd6f4]">Manage Liquidity</h2>
        <p className="text-sm text-[#6c7086] mt-1">Add or remove liquidity from the ALPHA/BETA pool.</p>
      </div>

      {/* Position Card */}
      <div className="dex-card bg-gradient-to-br from-[#6366f1]/10 to-[#181825]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#6c7086] uppercase tracking-wider font-semibold">Your Position</p>
            <p className="text-2xl font-bold text-[#cdd6f4] mt-1">{displayShares} <span className="text-sm font-normal text-[#6c7086]">shares</span></p>
          </div>
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-[#6366f1] flex items-center justify-center text-sm font-bold">A</div>
            <div className="w-8 h-8 rounded-full bg-[#a6e3a1] flex items-center justify-center text-sm font-bold text-[#1e1e2e]">B</div>
          </div>
        </div>

        {userShares && userShares > 0n && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-[#313244]/50 rounded-lg p-3">
              <p className="text-xs text-[#6c7086]">ALPHA in pool</p>
              <p className="text-sm font-semibold mt-1">~{formatTokenAmount(userShares / 2n)} ALPHA</p>
            </div>
            <div className="bg-[#313244]/50 rounded-lg p-3">
              <p className="text-xs text-[#6c7086]">BETA in pool</p>
              <p className="text-sm font-semibold mt-1">~{formatTokenAmount(userShares / 2n)} BETA</p>
            </div>
          </div>
        )}

        {(!userShares || userShares === 0n) && (
          <p className="mt-3 text-sm text-[#6c7086]">No active position. Add liquidity to get started.</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#313244]">
        <button
          onClick={() => setTab("mint")}
          className={`px-6 py-3 text-sm font-semibold transition-all ${tab === "mint" ? "tab-active" : "tab-inactive"}`}
        >
          ➕ Add Liquidity
        </button>
        <button
          onClick={() => setTab("burn")}
          className={`px-6 py-3 text-sm font-semibold transition-all ${tab === "burn" ? "tab-active" : "tab-inactive"}`}
        >
          🔥 Remove Liquidity
        </button>
      </div>

      {/* Mint Tab */}
      {tab === "mint" && (
        <div className="space-y-4">
          <div className="dex-card space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">ALPHA Amount</label>
              <div className="relative mt-2">
                <input
                  type="number"
                  value={amount0}
                  onChange={(e) => setAmount0(e.target.value)}
                  placeholder="0.0"
                  className="dex-input pr-20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6c7086]">ALPHA</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">BETA Amount</label>
              <div className="relative mt-2">
                <input
                  type="number"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  placeholder="0.0"
                  className="dex-input pr-20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6c7086]">BETA</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">Shares to Mint</label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="1000000"
                className="dex-input mt-2"
              />
            </div>

            <div className="bg-[#11111b] rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between text-[#6c7086]">
                <span>Pool share</span>
                <span className="text-[#cdd6f4]">~0.01%</span>
              </div>
              <div className="flex justify-between text-[#6c7086]">
                <span>Fee tier</span>
                <span className="text-[#cdd6f4]">0.3%</span>
              </div>
            </div>
          </div>

          {mintHash && <TxStatusBadge status={mintStatus} hash={mintHash} />}

          <button
            onClick={handleMint}
            disabled={!isConnected || mintPending}
            className="btn-primary w-full text-base"
          >
            {!isConnected ? "Connect Wallet" : mintPending ? "Confirm in MetaMask..." : "Add Liquidity"}
          </button>
        </div>
      )}

      {/* Burn Tab */}
      {tab === "burn" && (
        <div className="space-y-4">
          <div className="dex-card space-y-4">
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">Withdrawal Amount</label>
                <span className="text-sm font-bold text-[#6366f1]">{burnPercent}%</span>
              </div>

              {/* Percentage slider */}
              <input
                type="range"
                min="1"
                max="100"
                value={burnPercent}
                onChange={(e) => setBurnPercent(Number(e.target.value))}
                className="w-full accent-[#6366f1]"
              />

              <div className="flex gap-2 mt-3">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setBurnPercent(pct)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      burnPercent === pct
                        ? "bg-[#6366f1]/20 border-[#6366f1] text-[#6366f1]"
                        : "border-[#45475a] text-[#6c7086] hover:border-[#6366f1]"
                    }`}
                  >
                    {pct === 100 ? "MAX" : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {userShares && userShares > 0n && (
              <div className="bg-[#11111b] rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between text-[#6c7086]">
                  <span>Shares to burn</span>
                  <span className="text-[#cdd6f4] font-mono">
                    {formatTokenAmount((userShares * BigInt(burnPercent)) / 100n, 0, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-[#6c7086]">
                  <span>Est. ALPHA received</span>
                  <span className="text-[#a6e3a1]">~{formatTokenAmount((userShares * BigInt(burnPercent)) / 200n)} ALPHA</span>
                </div>
                <div className="flex justify-between text-[#6c7086]">
                  <span>Est. BETA received</span>
                  <span className="text-[#a6e3a1]">~{formatTokenAmount((userShares * BigInt(burnPercent)) / 200n)} BETA</span>
                </div>
              </div>
            )}

            {(!userShares || userShares === 0n) && (
              <div className="bg-[#f38ba8]/10 border border-[#f38ba8]/30 rounded-lg p-3">
                <p className="text-sm text-[#f38ba8]">No active position to withdraw.</p>
              </div>
            )}
          </div>

          {burnHash && <TxStatusBadge status={burnStatus} hash={burnHash} />}

          <button
            onClick={handleBurn}
            disabled={!isConnected || burnPending || !userShares || userShares === 0n}
            className="btn-primary w-full text-base bg-[#f38ba8] hover:bg-[#e07090]"
          >
            {!isConnected ? "Connect Wallet" : burnPending ? "Confirm in MetaMask..." : "Remove Liquidity"}
          </button>
        </div>
      )}
    </div>
  );
}

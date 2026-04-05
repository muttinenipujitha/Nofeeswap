"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useAccount, useReadContract } from "wagmi";
import { ArrowUpDown, AlertTriangle } from "lucide-react";
import { NOFEESWAP_OPERATOR_ABI, ERC20_ABI } from "@/abis";
import { ADDRESSES } from "@/utils/addresses";
import {
  parseTokenAmount,
  formatTokenAmount,
  priceToSqrtPriceX96,
  applySlippage,
  estimateAmountOut,
  estimatePriceImpact,
} from "@/utils/math";
import { useTxStatus, TxStatusBadge } from "@/hooks/useTxStatus";

const POOL_ID = BigInt("0x1234abcd"); // Replace with actual poolId after init
const MOCK_SQRT_PRICE = priceToSqrtPriceX96(1.0);
const MOCK_LIQUIDITY = BigInt("1000000000000000000");

export function SwapInterface() {
  const { address, isConnected } = useAccount();

  const [tokenIn, setTokenIn] = useState<"ALPHA" | "BETA">("ALPHA");
  const [amountIn, setAmountIn] = useState("");
  const [slippageBps, setSlippageBps] = useState(50); // 0.5% default
  const [customSlippage, setCustomSlippage] = useState("");
  const [showCustomSlippage, setShowCustomSlippage] = useState(false);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { status } = useTxStatus({ hash: txHash, description: "Swap" });

  const zeroForOne = tokenIn === "ALPHA";
  const tokenOut = zeroForOne ? "BETA" : "ALPHA";

  // Balances
  const { data: alphaBalance } = useReadContract({
    address: ADDRESSES.TOKEN_ALPHA,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });
  const { data: betaBalance } = useReadContract({
    address: ADDRESSES.TOKEN_BETA,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  const alphaBalFmt = alphaBalance ? formatTokenAmount(alphaBalance as bigint) : "0.000000";
  const betaBalFmt = betaBalance ? formatTokenAmount(betaBalance as bigint) : "0.000000";
  const inBalance = zeroForOne ? alphaBalFmt : betaBalFmt;

  // Estimates
  const parsedAmountIn = parseTokenAmount(amountIn || "0");
  const estimatedOut = estimateAmountOut(parsedAmountIn, MOCK_SQRT_PRICE, MOCK_LIQUIDITY, zeroForOne);
  const priceImpact = estimatePriceImpact(parsedAmountIn, MOCK_SQRT_PRICE, MOCK_LIQUIDITY);
  const sqrtPriceLimit = applySlippage(MOCK_SQRT_PRICE, slippageBps, zeroForOne);

  const highImpact = priceImpact > 5;
  const veryHighImpact = priceImpact > 15;

  const handleFlip = () => {
    setTokenIn((t) => (t === "ALPHA" ? "BETA" : "ALPHA"));
    setAmountIn("");
  };

  const handleMaxIn = () => {
    const bal = zeroForOne ? alphaBalance : betaBalance;
    if (bal) setAmountIn(formatTokenAmount(bal as bigint, 18, 6).replace(/\.?0+$/, ""));
  };

  const handleSlippagePreset = (bps: number) => {
    setSlippageBps(bps);
    setShowCustomSlippage(false);
    setCustomSlippage("");
  };

  const handleCustomSlippage = (val: string) => {
    setCustomSlippage(val);
    const pct = parseFloat(val);
    if (!isNaN(pct) && pct > 0 && pct <= 50) {
      setSlippageBps(Math.round(pct * 100));
    }
  };

  const handleSwap = () => {
    if (!isConnected || !amountIn) return;

    writeContract({
      address: ADDRESSES.NOFEESWAP_OPERATOR,
      abi: NOFEESWAP_OPERATOR_ABI,
      functionName: "swap",
      args: [
        POOL_ID,
        zeroForOne,
        parsedAmountIn as any,    // amountSpecified (positive = exact in)
        sqrtPriceLimit,           // sqrtPriceLimitX96
        "0x",
      ],
    });
  };

  const slippageOptions = [
    { label: "0.1%", bps: 10 },
    { label: "0.5%", bps: 50 },
    { label: "1%", bps: 100 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#cdd6f4]">Swap</h2>
        <p className="text-sm text-[#6c7086] mt-1">Trade ALPHA and BETA tokens.</p>
      </div>

      {/* Slippage Control */}
      <div className="dex-card">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">Slippage Tolerance</label>
          <span className={`text-sm font-bold ${slippageBps > 100 ? "text-[#f9e2af]" : "text-[#6366f1]"}`}>
            {(slippageBps / 100).toFixed(2)}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          {slippageOptions.map((opt) => (
            <button
              key={opt.bps}
              onClick={() => handleSlippagePreset(opt.bps)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                slippageBps === opt.bps && !showCustomSlippage
                  ? "bg-[#6366f1]/20 border-[#6366f1] text-[#6366f1]"
                  : "border-[#45475a] text-[#6c7086] hover:border-[#6366f1]"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustomSlippage((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              showCustomSlippage
                ? "bg-[#6366f1]/20 border-[#6366f1] text-[#6366f1]"
                : "border-[#45475a] text-[#6c7086] hover:border-[#6366f1]"
            }`}
          >
            Custom
          </button>
        </div>

        {showCustomSlippage && (
          <div className="relative mt-3">
            <input
              type="number"
              value={customSlippage}
              onChange={(e) => handleCustomSlippage(e.target.value)}
              placeholder="0.50"
              className="dex-input pr-10"
              min="0.01"
              max="50"
              step="0.01"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6c7086]">%</span>
          </div>
        )}

        {slippageBps > 500 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-[#f9e2af]">
            <AlertTriangle size={12} />
            <span>High slippage — your transaction may be frontrun</span>
          </div>
        )}
      </div>

      {/* Swap Box */}
      <div className="dex-card space-y-2">
        {/* Input */}
        <div className="bg-[#11111b] rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#6c7086]">You pay</span>
            <span className="text-xs text-[#6c7086]">
              Balance: {inBalance}{" "}
              <button onClick={handleMaxIn} className="text-[#6366f1] hover:underline ml-1">MAX</button>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl font-semibold text-[#cdd6f4] outline-none"
            />
            <div className="flex items-center gap-2 bg-[#313244] rounded-xl px-4 py-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                tokenIn === "ALPHA" ? "bg-[#6366f1]" : "bg-[#a6e3a1] text-[#1e1e2e]"
              }`}>
                {tokenIn[0]}
              </div>
              <span className="font-semibold">{tokenIn}</span>
            </div>
          </div>
        </div>

        {/* Flip button */}
        <div className="flex justify-center">
          <button
            onClick={handleFlip}
            className="bg-[#313244] hover:bg-[#45475a] border-2 border-[#1e1e2e] rounded-xl p-2 transition-all hover:rotate-180 duration-300"
          >
            <ArrowUpDown size={18} className="text-[#6366f1]" />
          </button>
        </div>

        {/* Output */}
        <div className="bg-[#11111b] rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#6c7086]">You receive (estimated)</span>
            <span className="text-xs text-[#6c7086]">
              Balance: {zeroForOne ? betaBalFmt : alphaBalFmt}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-2xl font-semibold text-[#a6e3a1]">
              {formatTokenAmount(estimatedOut)}
            </span>
            <div className="flex items-center gap-2 bg-[#313244] rounded-xl px-4 py-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                tokenOut === "ALPHA" ? "bg-[#6366f1]" : "bg-[#a6e3a1] text-[#1e1e2e]"
              }`}>
                {tokenOut[0]}
              </div>
              <span className="font-semibold">{tokenOut}</span>
            </div>
          </div>
        </div>

        {/* Trade Details */}
        {amountIn && parseFloat(amountIn) > 0 && (
          <div className="bg-[#11111b] rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-[#6c7086]">
              <span>Rate</span>
              <span className="text-[#cdd6f4]">1 {tokenIn} ≈ {formatTokenAmount(estimateAmountOut(parseTokenAmount("1"), MOCK_SQRT_PRICE, MOCK_LIQUIDITY, zeroForOne))} {tokenOut}</span>
            </div>
            <div className="flex justify-between text-[#6c7086]">
              <span>Price Impact</span>
              <span className={veryHighImpact ? "text-[#f38ba8] font-bold" : highImpact ? "text-[#f9e2af]" : "text-[#a6e3a1]"}>
                {veryHighImpact ? "⚠️ " : ""}{priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-[#6c7086]">
              <span>Max Slippage</span>
              <span className="text-[#cdd6f4]">{(slippageBps / 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-[#6c7086]">
              <span>Min. Received</span>
              <span className="text-[#cdd6f4]">
                {formatTokenAmount(
                  (estimatedOut * BigInt(10000 - slippageBps)) / 10000n
                )} {tokenOut}
              </span>
            </div>
            <div className="flex justify-between text-[#6c7086]">
              <span>sqrtPriceLimitX96</span>
              <span className="text-[#cba6f7] font-mono text-xs">{sqrtPriceLimit.toString().slice(0, 16)}...</span>
            </div>
          </div>
        )}

        {veryHighImpact && (
          <div className="flex items-center gap-2 bg-[#f38ba8]/10 border border-[#f38ba8]/30 rounded-xl p-3">
            <AlertTriangle size={16} className="text-[#f38ba8] shrink-0" />
            <p className="text-sm text-[#f38ba8]">
              Very high price impact ({priceImpact.toFixed(1)}%). You will likely lose money.
            </p>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="space-y-3">
        {txHash && <TxStatusBadge status={status} hash={txHash} />}

        <button
          onClick={handleSwap}
          disabled={!isConnected || isPending || !amountIn || parseFloat(amountIn) <= 0}
          className={`btn-primary w-full text-base ${
            veryHighImpact ? "bg-[#f38ba8] hover:bg-[#e07090]" : ""
          }`}
        >
          {!isConnected
            ? "Connect Wallet"
            : isPending
            ? "Confirm in MetaMask..."
            : !amountIn
            ? "Enter Amount"
            : veryHighImpact
            ? "⚠️ Swap Anyway"
            : "Swap"}
        </button>
      </div>
    </div>
  );
}

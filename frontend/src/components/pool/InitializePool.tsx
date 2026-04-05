"use client";

import { useState, useCallback } from "react";
import { useWriteContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { encodeAbiParameters, encodeFunctionData } from "viem";
import { NOFEESWAP_CORE_ABI } from "@/abis";
import { ADDRESSES, getCanonicalTokenOrder } from "@/utils/addresses";
import { KernelEditor } from "@/components/kernel/KernelEditor";
import toast from "react-hot-toast";

// INofeeswapDelegatee.initialize selector
// Computed from: keccak256("initialize(uint256,uint256,uint256,uint256,uint256[],uint256[],bytes)")
const INITIALIZE_SELECTOR = "0x05970088" as const;

// Mock kernel from SwapData_test.py#L841-L846
const MOCK_KERNEL: bigint[] = [0n, 32767n];

// Mock curve sequence from SwapData_test.py
// A simple linear curve: one segment from 0 to max
const MOCK_CURVE: bigint[] = [
  BigInt("0x0000000000000001000000000000000100000000000000010000000000000001"),
];

const FEE_TIERS = [
  { label: "0.01%", bps: 100,   growthPortion: BigInt("0x00000000000028f5c28f5c28f5c28f5c") },
  { label: "0.05%", bps: 500,   growthPortion: BigInt("0x0000000000014f8b588e368f08c379a3") },
  { label: "0.3%",  bps: 3000,  growthPortion: BigInt("0x0000000000051eb851eb851eb851eb85") },
  { label: "1%",    bps: 10000, growthPortion: BigInt("0x000000000011111111111111111111111") },
];

export function InitializePool() {
  const { isConnected, address } = useAccount();
  const [feeTier, setFeeTier] = useState(2); // index into FEE_TIERS
  const [initialPrice, setInitialPrice] = useState("1.0");
  const [useDefaultKernel, setUseDefaultKernel] = useState(true);
  const [kernelCompact, setKernelCompact] = useState<bigint[]>(MOCK_KERNEL);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContract, isPending } = useWriteContract();
  const { isSuccess, isError } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess && txHash) toast.success("✅ Pool initialized!", { id: txHash });
  if (isError && txHash) toast.error("❌ Initialize failed — check console", { id: txHash });

  const handleKernelChange = useCallback((compact: number[]) => {
    setKernelCompact(compact.map(BigInt));
  }, []);

  const handleInitialize = async () => {
    if (!isConnected || !address) {
      toast.error("Connect your wallet first");
      return;
    }
    if (ADDRESSES.NOFEESWAP_CORE === "0x0000000000000000000000000000000000000000") {
      toast.error("⚠️ Set NEXT_PUBLIC_NOFEESWAP_CORE in .env.local");
      return;
    }

    try {
      // Canonical token ordering: tag0 < tag1
      const [token0, token1] = getCanonicalTokenOrder(
        ADDRESSES.TOKEN_ALPHA,
        ADDRESSES.TOKEN_BETA
      );
      const tag0 = BigInt(token0);
      const tag1 = BigInt(token1);

      // unsaltedPoolId: encode tag0 and tag1 with fee spacing
      // Format from YellowPaper: pack token addresses + logSpacing
      // Using a simple deterministic ID for demo
      const logSpacing = BigInt(FEE_TIERS[feeTier].bps);
      const unsaltedPoolId = (tag0 << 96n) ^ (tag1 << 32n) ^ logSpacing;

      const selectedFee = FEE_TIERS[feeTier];
      const kernel = useDefaultKernel ? MOCK_KERNEL : kernelCompact;

      // Encode the initialize() call for dispatch()
      // ABI-encode the arguments (without selector first)
      const argsEncoded = encodeAbiParameters(
        [
          { type: "uint256" }, // unsaltedPoolId
          { type: "uint256" }, // tag0
          { type: "uint256" }, // tag1
          { type: "uint256" }, // poolGrowthPortion (X47 fee)
          { type: "uint256[]" }, // kernelCompactArray
          { type: "uint256[]" }, // curveArray
          { type: "bytes" },    // hookData
        ],
        [
          unsaltedPoolId,
          tag0,
          tag1,
          selectedFee.growthPortion,
          kernel,
          MOCK_CURVE,
          "0x",
        ]
      );

      // Prepend initialize selector
      const dispatchInput = (INITIALIZE_SELECTOR + argsEncoded.slice(2)) as `0x${string}`;

      toast.loading("⏳ Initializing pool...", { id: "init" });

      writeContract(
        {
          address: ADDRESSES.NOFEESWAP_CORE,
          abi: NOFEESWAP_CORE_ABI,
          functionName: "dispatch",
          args: [dispatchInput],
        },
        {
          onSuccess: (hash) => {
            setTxHash(hash);
            toast.loading("⏳ Confirming...", { id: "init" });
          },
          onError: (err) => {
            toast.error(`❌ ${err.message.slice(0, 80)}`, { id: "init" });
          },
        }
      );
    } catch (err: any) {
      toast.error(`❌ Encoding error: ${err.message?.slice(0, 60)}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#cdd6f4]">Initialize Pool</h2>
        <p className="text-sm text-[#6c7086] mt-1">
          Create a new ALPHA/BETA pool. Calls <code className="text-[#cba6f7] font-mono">dispatch(initialize(...))</code> on the core.
        </p>
      </div>

      {/* Token pair */}
      <div className="dex-card">
        <label className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">Token Pair</label>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-2 bg-[#313244] rounded-lg px-4 py-2">
            <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-xs font-bold">A</div>
            <span className="font-semibold">ALPHA</span>
            <span className="text-xs text-[#6c7086] font-mono">{ADDRESSES.TOKEN_ALPHA.slice(0,6)}…</span>
          </div>
          <span className="text-[#6c7086]">/</span>
          <div className="flex items-center gap-2 bg-[#313244] rounded-lg px-4 py-2">
            <div className="w-6 h-6 rounded-full bg-[#a6e3a1] flex items-center justify-center text-xs font-bold text-[#1e1e2e]">B</div>
            <span className="font-semibold">BETA</span>
            <span className="text-xs text-[#6c7086] font-mono">{ADDRESSES.TOKEN_BETA.slice(0,6)}…</span>
          </div>
        </div>
      </div>

      {/* Fee tier */}
      <div className="dex-card">
        <label className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">Fee Tier (logSpacing)</label>
        <div className="grid grid-cols-4 gap-2 mt-3">
          {FEE_TIERS.map((f, i) => (
            <button
              key={f.bps}
              onClick={() => setFeeTier(i)}
              className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                feeTier === i
                  ? "bg-[#6366f1]/20 border-[#6366f1] text-[#6366f1]"
                  : "border-[#45475a] text-[#6c7086] hover:border-[#6366f1]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kernel */}
      <div className="dex-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">Kernel Shape</label>
            <p className="text-xs text-[#6c7086] mt-1">Liquidity distribution curve (YellowPaper §4)</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-[#6c7086]">Use mock</span>
            <div
              onClick={() => setUseDefaultKernel(v => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${useDefaultKernel ? "bg-[#6366f1]" : "bg-[#45475a]"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${useDefaultKernel ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </label>
        </div>

        {useDefaultKernel ? (
          <div className="bg-[#11111b] rounded-xl p-4 border border-[#313244]">
            <p className="text-sm text-[#6c7086]">
              Mock kernel from <code className="text-[#cba6f7] font-mono">SwapData_test.py#L841-L846</code>
            </p>
            <code className="block mt-2 text-xs text-[#a6e3a1] font-mono">
              kernelCompact = [0, 32767]
            </code>
          </div>
        ) : (
          <KernelEditor onChange={handleKernelChange} />
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleInitialize}
        disabled={!isConnected || isPending}
        className="btn-primary w-full text-base"
      >
        {!isConnected ? "Connect Wallet First"
          : isPending ? "Confirm in MetaMask..."
          : isSuccess ? "✅ Pool Initialized!"
          : "Initialize Pool"}
      </button>

      {!isConnected && (
        <p className="text-xs text-center text-[#f38ba8]">Connect wallet to continue.</p>
      )}

      <div className="bg-[#11111b] rounded-xl p-3 border border-[#313244]">
        <p className="text-xs text-[#6c7086]">
          <strong className="text-[#cba6f7]">How it works:</strong> Calls{" "}
          <code className="font-mono">Nofeeswap.dispatch(initialize(...))</code> which
          delegatecalls to <code className="font-mono">NofeeswapDelegatee</code>.
          Pool state is stored in Nofeeswap's transient + persistent storage.
        </p>
      </div>
    </div>
  );
}

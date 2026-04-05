"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance } from "wagmi";
import { ADDRESSES } from "@/utils/addresses";
import { formatTokenAmount } from "@/utils/math";
import { useReadContract } from "wagmi";
import { ERC20_ABI } from "@/abis";

export function WalletStatus() {
  const { address, isConnected, chain } = useAccount();

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

  const { data: ethBalance } = useBalance({ address, query: { enabled: !!address } });

  if (!isConnected) {
    return (
      <div className="dex-card text-center py-8">
        <div className="text-4xl mb-3">🦊</div>
        <h3 className="font-bold text-[#cdd6f4] mb-2">Connect Your Wallet</h3>
        <p className="text-sm text-[#6c7086] mb-4">
          Connect MetaMask to interact with the NoFeeSwap local testnet.
        </p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  const wrongNetwork = chain?.id !== 31337;

  return (
    <div className="dex-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[#6c7086] uppercase tracking-wider">Wallet</h3>
        {wrongNetwork && (
          <span className="text-xs bg-[#f38ba8]/10 border border-[#f38ba8]/30 text-[#f38ba8] px-2 py-1 rounded-lg">
            ⚠️ Wrong Network
          </span>
        )}
        {!wrongNetwork && (
          <span className="text-xs bg-[#a6e3a1]/10 border border-[#a6e3a1]/30 text-[#a6e3a1] px-2 py-1 rounded-lg flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a6e3a1] inline-block" />
            Anvil Local
          </span>
        )}
      </div>

      <div className="font-mono text-sm bg-[#11111b] rounded-lg px-3 py-2 text-[#cba6f7] truncate">
        {address}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-[#11111b] rounded-lg p-2">
          <p className="text-xs text-[#6c7086]">ETH</p>
          <p className="text-sm font-semibold mt-0.5">
            {ethBalance ? Number(ethBalance.formatted).toFixed(4) : "—"}
          </p>
        </div>
        <div className="bg-[#11111b] rounded-lg p-2">
          <p className="text-xs text-[#6c7086]">ALPHA</p>
          <p className="text-sm font-semibold mt-0.5 text-[#6366f1]">
            {alphaBalance ? formatTokenAmount(alphaBalance as bigint, 18, 2) : "—"}
          </p>
        </div>
        <div className="bg-[#11111b] rounded-lg p-2">
          <p className="text-xs text-[#6c7086]">BETA</p>
          <p className="text-sm font-semibold mt-0.5 text-[#a6e3a1]">
            {betaBalance ? formatTokenAmount(betaBalance as bigint, 18, 2) : "—"}
          </p>
        </div>
      </div>

      {wrongNetwork && (
        <p className="text-xs text-[#f38ba8] text-center">
          Please switch to Anvil Local (Chain ID 31337) in MetaMask.
        </p>
      )}
    </div>
  );
}

// src/hooks/usePool.ts
// Hook for reading pool state from NoFeeSwap core

import { useReadContract, useReadContracts } from "wagmi";
import { NOFEESWAP_CORE_ABI, ERC20_ABI } from "@/abis";
import { ADDRESSES, getCanonicalTokenOrder } from "@/utils/addresses";
import { sqrtPriceX96ToPrice, formatTokenAmount } from "@/utils/math";

export interface PoolState {
  sqrtPrice: bigint;
  liquidity: bigint;
  price: number;
  isInitialized: boolean;
}

// Placeholder pool ID — replace with actual ID after initialization
const DEMO_POOL_ID = BigInt("0x1234abcd");

export function usePool(poolId?: bigint) {
  const id = poolId ?? DEMO_POOL_ID;

  const { data, isLoading, error } = useReadContract({
    address: ADDRESSES.NOFEESWAP_CORE,
    abi: NOFEESWAP_CORE_ABI,
    functionName: "pools",
    args: [id],
    query: { refetchInterval: 5000 }, // re-read every 5s
  });

  const poolData = data as [bigint, bigint, string] | undefined;

  const state: PoolState | undefined = poolData
    ? {
        sqrtPrice: poolData[0],
        liquidity: poolData[1],
        price: sqrtPriceX96ToPrice(poolData[0]),
        isInitialized: poolData[0] > 0n,
      }
    : undefined;

  return { pool: state, isLoading, error };
}

export function useTokenBalances(userAddress?: `0x${string}`) {
  const { data } = useReadContracts({
    contracts: [
      {
        address: ADDRESSES.TOKEN_ALPHA,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [userAddress ?? "0x0000000000000000000000000000000000000000"],
      },
      {
        address: ADDRESSES.TOKEN_BETA,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [userAddress ?? "0x0000000000000000000000000000000000000000"],
      },
    ],
    query: { enabled: !!userAddress, refetchInterval: 3000 },
  });

  return {
    alphaBalance: (data?.[0]?.result as bigint | undefined) ?? 0n,
    betaBalance: (data?.[1]?.result as bigint | undefined) ?? 0n,
    alphaFormatted: formatTokenAmount((data?.[0]?.result as bigint | undefined) ?? 0n),
    betaFormatted: formatTokenAmount((data?.[1]?.result as bigint | undefined) ?? 0n),
  };
}

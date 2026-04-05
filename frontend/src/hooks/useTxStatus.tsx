"use client";

import { useEffect, useRef } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import toast from "react-hot-toast";

type TxStatus = "idle" | "pending" | "success" | "error";

interface UseTxStatusOptions {
  hash?: `0x${string}`;
  onSuccess?: () => void;
  onError?: () => void;
  description?: string;
}

export function useTxStatus({ hash, onSuccess, onError, description = "Transaction" }: UseTxStatusOptions) {
  const toastIdRef = useRef<string | null>(null);

  const { isLoading, isSuccess, isError, data } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });

  useEffect(() => {
    if (!hash) return;

    // Show pending toast
    const id = toast.loading(`⏳ ${description} pending...`, {
      style: {
        background: "#1e1e2e",
        color: "#f9e2af",
        border: "1px solid #f9e2af40",
      },
    });
    toastIdRef.current = id;

    return () => {
      if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    };
  }, [hash, description]);

  useEffect(() => {
    if (!toastIdRef.current) return;

    if (isSuccess) {
      toast.success(`✅ ${description} confirmed!`, {
        id: toastIdRef.current,
        duration: 5000,
        style: {
          background: "#1e1e2e",
          color: "#a6e3a1",
          border: "1px solid #a6e3a140",
        },
      });
      onSuccess?.();
      toastIdRef.current = null;
    }

    if (isError) {
      toast.error(`❌ ${description} reverted`, {
        id: toastIdRef.current,
        duration: 5000,
        style: {
          background: "#1e1e2e",
          color: "#f38ba8",
          border: "1px solid #f38ba840",
        },
      });
      onError?.();
      toastIdRef.current = null;
    }
  }, [isSuccess, isError, description, onSuccess, onError]);

  let status: TxStatus = "idle";
  if (isLoading) status = "pending";
  else if (isSuccess) status = "success";
  else if (isError) status = "error";

  return { status, isLoading, isSuccess, isError, receipt: data };
}

// ── TxStatusBadge component ──────────────────────────────────────────────────
interface TxStatusBadgeProps {
  status: TxStatus;
  hash?: `0x${string}`;
}

export function TxStatusBadge({ status, hash }: TxStatusBadgeProps) {
  if (status === "idle") return null;

  const config = {
    pending: { label: "Pending", className: "tx-pending", icon: "⏳" },
    success: { label: "Confirmed", className: "tx-confirmed", icon: "✅" },
    error: { label: "Reverted", className: "tx-reverted", icon: "❌" },
  }[status];

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${config.className}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {hash && (
        <span className="font-mono text-xs opacity-70">
          {hash.slice(0, 8)}...{hash.slice(-6)}
        </span>
      )}
    </div>
  );
}

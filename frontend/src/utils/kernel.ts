// src/utils/kernel.ts
// ─────────────────────────────────────────────────────────────────────────────
// NoFeeSwap Kernel Encoding
//
// From the YellowPaper: A "kernel" defines the shape of liquidity distribution
// across price intervals. It is encoded as a compact sequence of breakpoints
// where each breakpoint specifies a relative price offset and liquidity weight.
//
// The kernelCompact format (int24[]) packs:
//   - Breakpoint price as a log2(sqrtPrice) offset
//   - Liquidity weight at that breakpoint
//
// Reference: SwapData_test.py#L841-L846 provides a working mock kernel.
// ─────────────────────────────────────────────────────────────────────────────

export interface KernelPoint {
  /** Normalized x position [0, 1] representing price range position */
  x: number;
  /** Normalized y position [0, 1] representing liquidity weight */
  y: number;
}

export interface KernelSegment {
  from: KernelPoint;
  to: KernelPoint;
  /** Bézier control point for the curve shape */
  controlX: number;
  controlY: number;
}

/**
 * Default kernel from SwapData_test.py#L841-L846.
 * This is the mock implementation — a simple uniform distribution.
 *
 * In the Python test:
 *   kernel = [(0, 0), (1 << 15, 1 << 15)]
 *   curveSequence = [kernel]
 */
export const DEFAULT_KERNEL_COMPACT: number[] = [
  0,        // breakpoint 0: at sqrtPrice offset 0, weight 0
  32767,    // breakpoint 1: at max offset (2^15 - 1), weight 2^15 - 1
];

/**
 * Default visual kernel — a straight line (uniform liquidity)
 */
export const DEFAULT_KERNEL_POINTS: KernelPoint[] = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0.5 },
  { x: 1, y: 1 },
];

/**
 * Convert visual kernel points (from the drag editor) into
 * kernelCompact int24[] encoding for the NoFeeSwap initialize() call.
 *
 * Each point maps to: [priceOffset, liquidityWeight]
 * where priceOffset ∈ [0, 2^15) and liquidityWeight ∈ [0, 2^15)
 *
 * This is an approximation of the full YellowPaper §4 encoding.
 * A production implementation would implement the exact bit-packing.
 */
export function pointsToKernelCompact(points: KernelPoint[]): number[] {
  const MAX_VAL = (1 << 15) - 1; // 32767

  const compact: number[] = [];
  for (const pt of points) {
    const priceOffset = Math.round(Math.max(0, Math.min(1, pt.x)) * MAX_VAL);
    const liquidityWeight = Math.round(Math.max(0, Math.min(1, pt.y)) * MAX_VAL);
    compact.push(priceOffset, liquidityWeight);
  }
  return compact;
}

/**
 * Convert kernelCompact back to visual points for display.
 */
export function kernelCompactToPoints(compact: number[]): KernelPoint[] {
  const MAX_VAL = (1 << 15) - 1;
  const points: KernelPoint[] = [];
  for (let i = 0; i < compact.length - 1; i += 2) {
    points.push({
      x: compact[i] / MAX_VAL,
      y: compact[i + 1] / MAX_VAL,
    });
  }
  return points;
}

/**
 * Validate kernel compact sequence:
 * - Must have at least 2 breakpoints (start + end)
 * - Price offsets must be strictly increasing
 * - Weights must be non-negative
 */
export function validateKernel(compact: number[]): { valid: boolean; error?: string } {
  if (compact.length < 4) {
    return { valid: false, error: "Kernel must have at least 2 breakpoints (4 values)" };
  }
  if (compact.length % 2 !== 0) {
    return { valid: false, error: "Kernel compact must have even number of values" };
  }

  for (let i = 0; i < compact.length; i += 2) {
    if (compact[i] < 0 || compact[i + 1] < 0) {
      return { valid: false, error: "Kernel values must be non-negative" };
    }
    if (i > 0 && compact[i] <= compact[i - 2]) {
      return { valid: false, error: "Price offsets must be strictly increasing" };
    }
  }

  return { valid: true };
}

/**
 * Preset kernel shapes for common liquidity strategies.
 */
export const KERNEL_PRESETS: Record<string, KernelPoint[]> = {
  uniform: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
  concentrated: [
    { x: 0, y: 0 },
    { x: 0.4, y: 0.1 },
    { x: 0.5, y: 0.8 },
    { x: 0.6, y: 0.1 },
    { x: 1, y: 0 },
  ],
  skewedRight: [
    { x: 0, y: 0 },
    { x: 0.3, y: 0.6 },
    { x: 0.7, y: 0.9 },
    { x: 1, y: 1 },
  ],
  skewedLeft: [
    { x: 0, y: 0 },
    { x: 0.3, y: 0.1 },
    { x: 0.7, y: 0.4 },
    { x: 1, y: 1 },
  ],
};

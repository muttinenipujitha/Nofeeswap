"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  KernelPoint,
  DEFAULT_KERNEL_POINTS,
  KERNEL_PRESETS,
  pointsToKernelCompact,
  validateKernel,
} from "@/utils/kernel";

interface KernelEditorProps {
  onChange: (kernelCompact: number[]) => void;
  width?: number;
  height?: number;
}

const PADDING = 40;
const POINT_RADIUS = 8;

export function KernelEditor({ onChange, width = 500, height = 280 }: KernelEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [points, setPoints] = useState<KernelPoint[]>(DEFAULT_KERNEL_POINTS);
  const [dragging, setDragging] = useState<number | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("uniform");

  const innerW = width - PADDING * 2;
  const innerH = height - PADDING * 2;

  // Convert normalized [0,1] to SVG coordinates
  const toSvg = (p: KernelPoint) => ({
    x: PADDING + p.x * innerW,
    y: PADDING + (1 - p.y) * innerH, // flip Y axis
  });

  // Convert SVG coordinates to normalized [0,1]
  const fromSvg = (svgX: number, svgY: number): KernelPoint => ({
    x: Math.max(0, Math.min(1, (svgX - PADDING) / innerW)),
    y: Math.max(0, Math.min(1, 1 - (svgY - PADDING) / innerH)),
  });

  // Build SVG path from points (smooth Catmull-Rom spline)
  const buildPath = (pts: KernelPoint[]): string => {
    if (pts.length < 2) return "";
    const coords = pts.map(toSvg);

    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(0, i - 1)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(coords.length - 1, i + 2)];

      // Catmull-Rom to cubic Bézier conversion
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  // Build filled area path
  const buildAreaPath = (pts: KernelPoint[]): string => {
    if (pts.length < 2) return "";
    const coords = pts.map(toSvg);
    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const bottom = PADDING + innerH;

    const linePath = buildPath(pts);
    return `${linePath} L ${lastX} ${bottom} L ${firstX} ${bottom} Z`;
  };

  const getSvgPoint = (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(index);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging === null) return;
      const { x, y } = getSvgPoint(e);
      const newPt = fromSvg(x, y);

      setPoints((prev) => {
        const next = [...prev];
        // First and last points: lock X to 0 and 1
        if (dragging === 0) newPt.x = 0;
        if (dragging === prev.length - 1) newPt.x = 1;
        // Enforce monotonic X ordering
        if (dragging > 0) newPt.x = Math.max(prev[dragging - 1].x + 0.01, newPt.x);
        if (dragging < prev.length - 1)
          newPt.x = Math.min(prev[dragging + 1].x - 0.01, newPt.x);
        next[dragging] = newPt;
        return next;
      });
    },
    [dragging]
  );

  const handleMouseUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Add a new point on click (not on existing point)
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging !== null) return;
    const { x, y } = getSvgPoint(e);
    const newPt = fromSvg(x, y);

    // Don't add if clicking near existing point
    for (const p of points) {
      const s = toSvg(p);
      const dx = s.x - x;
      const dy = s.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < POINT_RADIUS * 2) return;
    }

    setPoints((prev) => {
      const next = [...prev, newPt];
      next.sort((a, b) => a.x - b.x);
      return next;
    });
  };

  // Remove a point on right-click (keep min 2)
  const handleContextMenu = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (points.length <= 2) return;
    if (index === 0 || index === points.length - 1) return; // keep endpoints
    setPoints((prev) => prev.filter((_, i) => i !== index));
  };

  // Load a preset
  const loadPreset = (name: string) => {
    setSelectedPreset(name);
    setPoints(KERNEL_PRESETS[name] ?? DEFAULT_KERNEL_POINTS);
  };

  // Emit changes upward
  useEffect(() => {
    const compact = pointsToKernelCompact(points);
    const { valid } = validateKernel(compact);
    if (valid) onChange(compact);
  }, [points, onChange]);

  const path = buildPath(points);
  const areaPath = buildAreaPath(points);

  return (
    <div className="space-y-3">
      {/* Preset buttons */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-[#6c7086] self-center">Presets:</span>
        {Object.keys(KERNEL_PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => loadPreset(name)}
            className={`text-xs px-3 py-1 rounded-md border transition-colors ${
              selectedPreset === name
                ? "bg-[#6366f1]/20 border-[#6366f1] text-[#6366f1]"
                : "border-[#45475a] text-[#6c7086] hover:border-[#6366f1] hover:text-[#cdd6f4]"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* SVG canvas */}
      <div className="bg-[#11111b] rounded-xl border border-[#313244] overflow-hidden">
        <div className="px-4 py-2 border-b border-[#313244] flex items-center justify-between">
          <span className="text-xs text-[#6c7086] font-mono">
            Kernel Shape Editor — drag points to reshape · click to add · right-click to remove
          </span>
          <span className="text-xs text-[#6c7086]">{points.length} breakpoints</span>
        </div>

        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="kernel-canvas w-full"
          onClick={handleSvgClick}
          style={{ maxWidth: "100%" }}
        >
          <defs>
            <linearGradient id="kernelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const xPos = PADDING + t * innerW;
            const yPos = PADDING + t * innerH;
            return (
              <g key={t}>
                <line
                  x1={xPos} y1={PADDING} x2={xPos} y2={PADDING + innerH}
                  stroke="#313244" strokeWidth="1" strokeDasharray="4,4"
                />
                <line
                  x1={PADDING} y1={yPos} x2={PADDING + innerW} y2={yPos}
                  stroke="#313244" strokeWidth="1" strokeDasharray="4,4"
                />
              </g>
            );
          })}

          {/* Axis labels */}
          <text x={PADDING} y={PADDING + innerH + 20} fill="#6c7086" fontSize="10" textAnchor="middle">Low Price</text>
          <text x={PADDING + innerW} y={PADDING + innerH + 20} fill="#6c7086" fontSize="10" textAnchor="middle">High Price</text>
          <text x={PADDING - 28} y={PADDING + innerH} fill="#6c7086" fontSize="10" textAnchor="middle">0</text>
          <text x={PADDING - 28} y={PADDING} fill="#6c7086" fontSize="10" textAnchor="middle">Max</text>
          <text x={PADDING - 28} y={PADDING + innerH / 2} fill="#6c7086" fontSize="10" textAnchor="middle" transform={`rotate(-90, ${PADDING - 28}, ${PADDING + innerH / 2})`}>Liquidity</text>

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill="url(#kernelGrad)" />
          )}

          {/* Curve line */}
          {path && (
            <path
              d={path}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2.5"
              filter="url(#glow)"
            />
          )}

          {/* Control points */}
          {points.map((pt, i) => {
            const { x, y } = toSvg(pt);
            const isEndpoint = i === 0 || i === points.length - 1;
            return (
              <g key={i}>
                {/* Outer ring */}
                <circle
                  cx={x} cy={y}
                  r={POINT_RADIUS + 4}
                  fill="transparent"
                  className="kernel-point"
                  onMouseDown={handleMouseDown(i)}
                  onContextMenu={handleContextMenu(i)}
                />
                {/* Glow */}
                <circle
                  cx={x} cy={y}
                  r={POINT_RADIUS + 2}
                  fill="#6366f1"
                  fillOpacity="0.2"
                />
                {/* Main point */}
                <circle
                  cx={x} cy={y}
                  r={POINT_RADIUS}
                  fill={isEndpoint ? "#a6e3a1" : "#6366f1"}
                  stroke="#1e1e2e"
                  strokeWidth="2"
                  className="kernel-point"
                  onMouseDown={handleMouseDown(i)}
                  onContextMenu={handleContextMenu(i)}
                  filter="url(#glow)"
                />
                {/* Coordinates tooltip */}
                {dragging === i && (
                  <text
                    x={x + 12} y={y - 8}
                    fill="#cdd6f4"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    ({pt.x.toFixed(2)}, {pt.y.toFixed(2)})
                  </text>
                )}
              </g>
            );
          })}

          {/* Border */}
          <rect
            x={PADDING} y={PADDING}
            width={innerW} height={innerH}
            fill="none"
            stroke="#45475a"
            strokeWidth="1"
          />
        </svg>
      </div>

      <p className="text-xs text-[#6c7086]">
        Green points = fixed endpoints (price range bounds). Purple points = adjustable liquidity weights.
        This maps to NoFeeSwap's <code className="font-mono text-[#cba6f7]">kernelCompact</code> encoding (YellowPaper §4).
      </p>
    </div>
  );
}

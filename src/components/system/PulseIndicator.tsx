"use client";

type Status = "healthy" | "degraded" | "down" | "unknown";

interface PulseIndicatorProps {
  status: Status;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
}

const statusColors: Record<Status, string> = {
  healthy: "var(--mm-healthy)",
  degraded: "var(--mm-degraded)",
  down: "var(--mm-down)",
  unknown: "var(--mm-text-muted)",
};

const sizeMap = {
  sm: "w-2 h-2",
  md: "w-3 h-3",
  lg: "w-4 h-4",
};

export default function PulseIndicator({
  status,
  size = "md",
  showLabel = false,
  label,
}: PulseIndicatorProps) {
  const color = statusColors[status];

  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-flex">
        {/* Outer pulse ring */}
        {status === "healthy" && (
          <span
            className={`absolute inline-flex ${sizeMap[size]} opacity-75 animate-ping`}
            style={{ backgroundColor: color }}
          />
        )}
        {/* Core dot */}
        <span
          className={`relative inline-flex ${sizeMap[size]}`}
          style={{ backgroundColor: color }}
        />
      </span>
      {showLabel && label && (
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      )}
    </span>
  );
}

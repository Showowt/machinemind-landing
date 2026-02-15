"use client";

interface LogoProps {
  variant?: "emblem" | "horizontal" | "stacked";
  size?: number;
  showText?: boolean;
  showDescriptor?: boolean;
  className?: string;
}

// Singularity Emblem - The core logo mark
export function LogoEmblem({
  size = 64,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer ring */}
      <circle
        cx="100"
        cy="85"
        r="65"
        fill="none"
        stroke="rgba(0,180,255,0.25)"
        strokeWidth="1.5"
      />
      {/* Inner ring */}
      <circle
        cx="100"
        cy="85"
        r="48"
        fill="none"
        stroke="rgba(0,180,255,0.12)"
        strokeWidth="0.75"
      />
      {/* Core singularity */}
      <circle cx="100" cy="85" r="6" fill="#00B4FF" />
      <circle
        cx="100"
        cy="85"
        r="12"
        fill="none"
        stroke="#00B4FF"
        strokeWidth="0.5"
        opacity="0.5"
      />
      {/* Hex accent nodes */}
      <polygon
        points="100,20 105,26 105,34 100,40 95,34 95,26"
        fill="none"
        stroke="#00B4FF"
        strokeWidth="0.75"
        opacity="0.4"
      />
      <polygon
        points="157,55 162,61 162,69 157,75 152,69 152,61"
        fill="none"
        stroke="#00B4FF"
        strokeWidth="0.75"
        opacity="0.4"
      />
      <polygon
        points="43,55 48,61 48,69 43,75 38,69 38,61"
        fill="none"
        stroke="#00B4FF"
        strokeWidth="0.75"
        opacity="0.4"
      />
      {/* Connection lines */}
      <line
        x1="100"
        y1="40"
        x2="100"
        y2="73"
        stroke="rgba(0,180,255,0.15)"
        strokeWidth="0.5"
      />
      <line
        x1="152"
        y1="67"
        x2="113"
        y2="79"
        stroke="rgba(0,180,255,0.15)"
        strokeWidth="0.5"
      />
      <line
        x1="48"
        y1="67"
        x2="87"
        y2="79"
        stroke="rgba(0,180,255,0.15)"
        strokeWidth="0.5"
      />
      {/* MM Monogram - blue M + white M */}
      <path
        d="M 66 110 L 66 60 L 83 85 L 100 60 L 100 110"
        fill="none"
        stroke="#00B4FF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 100 110 L 100 60 L 117 85 L 134 60 L 134 110"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom connection */}
      <line
        x1="100"
        y1="110"
        x2="100"
        y2="145"
        stroke="rgba(0,180,255,0.2)"
        strokeWidth="0.75"
      />
      <circle cx="100" cy="148" r="2.5" fill="#00B4FF" opacity="0.5" />
    </svg>
  );
}

// Simplified emblem for small sizes (favicon, app icon)
export function LogoEmblemSimple({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="100"
        cy="100"
        r="80"
        fill="none"
        stroke="rgba(0,180,255,0.25)"
        strokeWidth="3"
      />
      <circle cx="100" cy="100" r="8" fill="#00B4FF" />
      <path
        d="M 66 125 L 66 75 L 83 100 L 100 75 L 100 125"
        fill="none"
        stroke="#00B4FF"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 100 125 L 100 75 L 117 100 L 134 75 L 134 125"
        fill="none"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Horizontal lockup with wordmark
export function LogoHorizontal({
  size = 48,
  showDescriptor = false,
  className = "",
}: {
  size?: number;
  showDescriptor?: boolean;
  className?: string;
}) {
  const iconSize = size;
  const fontSize = size * 0.65;
  const subFontSize = size * 0.18;

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <LogoEmblemSimple size={iconSize} />
      <div className="flex flex-col">
        <div
          className="font-heading font-extrabold tracking-tight leading-none"
          style={{ fontSize: `${fontSize}px` }}
        >
          <span className="text-[#00B4FF]">Machine</span>
          <span className="text-white">Mind</span>
        </div>
        {showDescriptor && (
          <div
            className="font-mono uppercase tracking-[0.3em] text-[var(--mm-text-muted)] mt-1"
            style={{ fontSize: `${subFontSize}px` }}
          >
            AI Infrastructure
          </div>
        )}
      </div>
    </div>
  );
}

// Stacked lockup for square contexts
export function LogoStacked({
  size = 200,
  showDescriptor = false,
  className = "",
}: {
  size?: number;
  showDescriptor?: boolean;
  className?: string;
}) {
  const iconSize = size * 0.6;
  const fontSize = size * 0.14;
  const subFontSize = size * 0.045;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <LogoEmblem size={iconSize} />
      <div
        className="font-heading font-extrabold tracking-tight leading-none mt-4"
        style={{ fontSize: `${fontSize}px` }}
      >
        <span className="text-[#00B4FF]">Machine</span>
        <span className="text-white">Mind</span>
      </div>
      {showDescriptor && (
        <div
          className="font-mono uppercase tracking-[0.4em] text-[var(--mm-text-muted)] mt-2"
          style={{ fontSize: `${subFontSize}px` }}
        >
          AI Infrastructure
        </div>
      )}
    </div>
  );
}

// Main Logo component with variant selection
export default function Logo({
  variant = "horizontal",
  size = 48,
  showDescriptor = false,
  className = "",
}: LogoProps) {
  switch (variant) {
    case "emblem":
      return <LogoEmblem size={size} className={className} />;
    case "stacked":
      return (
        <LogoStacked
          size={size}
          showDescriptor={showDescriptor}
          className={className}
        />
      );
    case "horizontal":
    default:
      return (
        <LogoHorizontal
          size={size}
          showDescriptor={showDescriptor}
          className={className}
        />
      );
  }
}

"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedLogoProps {
  size?: number;
  /** Show the wordmark text beside the mark */
  withWordmark?: boolean;
  /** Intensity of idle animation (0–1) */
  intensity?: number;
}

/**
 * MachineMind — Singularity Logo (Concept C)
 * The mark comes alive: orbital ring rotates, MM paths draw on mount,
 * core dot pulses, hex nodes breathe, connection lines animate.
 * On hover: everything intensifies.
 */
export default function AnimatedLogo({
  size = 80,
  withWordmark = false,
  intensity = 1,
}: AnimatedLogoProps) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const mmRef1 = useRef<SVGPathElement>(null);
  const mmRef2 = useRef<SVGPathElement>(null);

  // Draw MM paths on mount
  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el1 = mmRef1.current;
    const el2 = mmRef2.current;
    if (!el1 || !el2) return;

    const len1 = el1.getTotalLength();
    const len2 = el2.getTotalLength();

    if (!mounted) {
      el1.style.strokeDasharray = `${len1}`;
      el1.style.strokeDashoffset = `${len1}`;
      el2.style.strokeDasharray = `${len2}`;
      el2.style.strokeDashoffset = `${len2}`;
    } else {
      el1.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.23,1,0.32,1) 0.3s";
      el1.style.strokeDashoffset = "0";
      el2.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.23,1,0.32,1) 0.6s";
      el2.style.strokeDashoffset = "0";
    }
  }, [mounted]);

  const scale = size / 200;
  const ringDuration = hovered ? `${8 / intensity}s` : `${20 / intensity}s`;
  const glowOpacity = hovered ? 0.6 : 0.3 * intensity;
  const nodeOpacity = hovered ? 0.8 : 0.4 * intensity;
  const connOpacity = hovered ? 0.3 : 0.15 * intensity;
  const innerRingOpacity = hovered ? 0.2 : 0.12 * intensity;
  const outerRingOpacity = hovered ? 0.5 : 0.25 * intensity;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${size * 0.18}px`,
        cursor: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <style>{`
        @keyframes mm-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes mm-counter-rotate { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes mm-pulse-core { 0%, 100% { opacity: 0.9; } 50% { opacity: 1; } }
        @keyframes mm-glow-pulse { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.3; } }
        @keyframes mm-node-breathe { 0%, 100% { opacity: 0.28; } 50% { opacity: 0.4; } }
        @keyframes mm-conn-flow { 0% { stroke-dashoffset: 40; opacity: 0.075; } 50% { opacity: 0.15; } 100% { stroke-dashoffset: 0; opacity: 0.075; } }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", overflow: "visible" }}
        aria-label="MachineMind logo"
        role="img"
      >
        <defs>
          <radialGradient id="mmCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c9a96e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#c9a96e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mmInnerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c9a96e" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#c9a96e" stopOpacity="0" />
          </radialGradient>
          <filter id="mmGoldGlow">
            <feGaussianBlur stdDeviation={hovered ? "3" : "2"} result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Subtle glow behind the whole mark */}
        <circle
          cx="100" cy="85" r="70"
          fill="url(#mmInnerGlow)"
          style={{ animation: `mm-glow-pulse 4s ease-in-out infinite` }}
        />

        {/* Outer orbital ring — slow rotation */}
        <g style={{ animation: `mm-rotate ${ringDuration} linear infinite`, transformOrigin: "100px 85px" }}>
          <circle
            cx="100" cy="85" r="65"
            stroke="#c9a96e"
            strokeWidth={hovered ? 2 : 1.5}
            strokeOpacity={outerRingOpacity}
            strokeDasharray={hovered ? "none" : "4 8"}
            style={{ transition: "stroke-opacity 0.4s, stroke-width 0.4s" }}
          />
        </g>

        {/* Inner ring — counter rotation */}
        <g style={{ animation: `mm-counter-rotate ${(parseFloat(ringDuration) * 1.5)}s linear infinite`, transformOrigin: "100px 85px" }}>
          <circle
            cx="100" cy="85" r="48"
            stroke="#c9a96e"
            strokeWidth="0.75"
            strokeOpacity={innerRingOpacity}
            style={{ transition: "stroke-opacity 0.4s" }}
          />
        </g>

        {/* Core singularity dot */}
        <circle
          cx="100" cy="85" r="6"
          fill="#c9a96e"
          filter="url(#mmGoldGlow)"
          style={{
            animation: `mm-pulse-core 2.5s ease-in-out infinite`,
            transition: "r 0.3s",
          }}
        />
        {/* Core halo ring */}
        <circle
          cx="100" cy="85" r="12"
          stroke="#c9a96e"
          strokeWidth="0.5"
          strokeOpacity={hovered ? 0.6 : 0.3}
          style={{ transition: "stroke-opacity 0.4s" }}
        />

        {/* Hex nodes — top, right, left */}
        <g style={{ animation: `mm-node-breathe 3s ease-in-out infinite` }}>
          <polygon points="100,20 105,26 105,34 100,40 95,34 95,26"
            stroke="#c9a96e" strokeWidth="0.75" fill="none" />
          <polygon points="157,55 162,61 162,69 157,75 152,69 152,61"
            stroke="#c9a96e" strokeWidth="0.75" fill="none"
            style={{ animationDelay: "0.5s" }} />
          <polygon points="43,55 48,61 48,69 43,75 38,69 38,61"
            stroke="#c9a96e" strokeWidth="0.75" fill="none"
            style={{ animationDelay: "1s" }} />
        </g>

        {/* Connection lines — animated flow */}
        <line x1="100" y1="40" x2="100" y2="73"
          stroke="#c9a96e" strokeWidth="0.5"
          strokeDasharray="40"
          style={{ animation: `mm-conn-flow 3s ease-in-out infinite` }}
        />
        <line x1="152" y1="67" x2="113" y2="79"
          stroke="#c9a96e" strokeWidth="0.5"
          strokeDasharray="40"
          style={{ animation: `mm-conn-flow 3s ease-in-out infinite 1s` }}
        />
        <line x1="48" y1="67" x2="87" y2="79"
          stroke="#c9a96e" strokeWidth="0.5"
          strokeDasharray="40"
          style={{ animation: `mm-conn-flow 3s ease-in-out infinite 2s` }}
        />

        {/* MM Monogram — draws on mount */}
        {/* First M — Blue */}
        <path
          ref={mmRef1}
          d="M 66 110 L 66 60 L 83 85 L 100 60 L 100 110"
          stroke="#c9a96e"
          strokeWidth={hovered ? 4.5 : 4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter="url(#mmGoldGlow)"
          style={{ transition: "stroke-width 0.3s" }}
        />
        {/* Second M — White */}
        <path
          ref={mmRef2}
          d="M 100 110 L 100 60 L 117 85 L 134 60 L 134 110"
          stroke={hovered ? "#ffffff" : "rgba(240,240,243,0.9)"}
          strokeWidth={hovered ? 4.5 : 4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{ transition: "stroke 0.4s, stroke-width 0.3s" }}
        />

        {/* Bottom singularity tail */}
        <line x1="100" y1="110" x2="100" y2="145"
          stroke="#c9a96e" strokeWidth="0.75"
          strokeOpacity={hovered ? 0.4 : 0.2}
          style={{ transition: "stroke-opacity 0.4s" }}
        />
        <circle cx="100" cy="148" r="2.5" fill="#c9a96e"
          fillOpacity={hovered ? 0.7 : 0.4}
          style={{ transition: "fill-opacity 0.4s" }}
        />

        {/* Wordmark text below (optional, used in large emblem mode) */}
        {withWordmark && size >= 120 && (
          <text
            x="100" y="178"
            textAnchor="middle"
            fill="#c9a96e"
            fillOpacity={hovered ? 0.8 : 0.5}
            fontFamily="var(--font-clash,'Clash Display',monospace)"
            fontSize="9"
            fontWeight="700"
            letterSpacing="6"
            style={{ transition: "fill-opacity 0.4s", textTransform: "uppercase" }}
          >
            MACHINEMIND
          </text>
        )}
      </svg>

      {/* Wordmark text beside mark */}
      {withWordmark && (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <div style={{
            fontFamily: "var(--font-clash,'Clash Display',sans-serif)",
            fontWeight: 700,
            fontSize: `${size * 0.22}px`,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}>
            <span style={{ color: "#c9a96e" }}>Machine</span>
            <span style={{ color: "#f0f0f3" }}>Mind</span>
          </div>
          <div style={{
            fontFamily: "var(--font-space-mono, 'Space Mono', monospace)",
            fontSize: `${Math.max(size * 0.07, 8)}px`,
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: "rgba(240,240,243,0.3)",
          }}>
            AI Infrastructure
          </div>
        </div>
      )}
    </div>
  );
}

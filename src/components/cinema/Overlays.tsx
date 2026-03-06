"use client";

import { useEffect, useState } from "react";

/**
 * CinemaOverlays - Film grain and vignette effects
 * 
 * Creates a cinematic atmosphere with:
 * 1. Animated SVG film grain (feTurbulence noise)
 * 2. CSS vignette (box-shadow inset)
 * 
 * Both layers are fixed position, pointer-events-none,
 * and sit at the highest z-index to overlay all content.
 */

interface CinemaOverlaysProps {
  grainOpacity?: number;
  vignetteIntensity?: number;
  vignetteSpread?: number;
  enabled?: boolean;
}

export default function CinemaOverlays({
  grainOpacity = 0.03,
  vignetteIntensity = 0.6,
  vignetteSpread = 200,
  enabled = true,
}: CinemaOverlaysProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !enabled) return null;

  return (
    <>
      {/* FILM GRAIN - SVG feTurbulence animated noise */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none z-[99990]"
        style={{ opacity: grainOpacity }}
        aria-hidden="true"
      >
        <filter id="cinema-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#cinema-grain)" />
      </svg>

      {/* VIGNETTE - CSS box-shadow inset */}
      <div
        className="fixed inset-0 pointer-events-none z-[99989]"
        style={{
          boxShadow: `inset 0 0 ${vignetteSpread}px rgba(0,0,0,${vignetteIntensity})`,
        }}
        aria-hidden="true"
      />
    </>
  );
}

export { CinemaOverlays };

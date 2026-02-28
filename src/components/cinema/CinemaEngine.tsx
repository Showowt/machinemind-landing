"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import Script from "next/script";

interface CinemaEngineProps {
  brandName?: string;
  accentColor?: string;
  skipPreloader?: boolean;
  sound?: boolean;
}

/**
 * MachineMind Cinema Engine v2.0 Integration
 * 25-Layer Cinematic Web Experience
 *
 * Features activated via data-* attributes:
 * - data-text="slide-up|rotate-in|scroll-fade|scramble|wave|chars-up"
 * - data-velocity="skew|blur|stretch|opacity|letterspace|rgb-split"
 * - data-magnetic="0.3" + data-magnetic-inner
 * - data-displacement + data-displacement-src
 * - data-svg-draw
 * - data-lottie="/path.json"
 * - data-reveal + data-reveal-item
 */
export default function CinemaEngine({
  brandName = "MACHINEMIND",
  accentColor = "#00e5ff",
  skipPreloader = true, // Skip since we have our own loading sequence
  sound = false,
}: CinemaEngineProps) {
  const initialized = useRef(false);

  useEffect(() => {
    // Wait for all scripts to load
    const initCinema = () => {
      if (
        typeof window !== "undefined" &&
        (
          window as unknown as {
            CinemaEngine?: { boot: (config: CinemaEngineProps) => void };
          }
        ).CinemaEngine &&
        !initialized.current
      ) {
        initialized.current = true;
        (
          window as unknown as {
            CinemaEngine: { boot: (config: CinemaEngineProps) => void };
          }
        ).CinemaEngine.boot({
          brandName,
          accentColor,
          skipPreloader,
          sound,
        });
      }
    };

    // Check if already loaded
    if ((window as unknown as { CinemaEngine?: object }).CinemaEngine) {
      initCinema();
    }

    // Listen for script load
    window.addEventListener("cinema:scriptsLoaded", initCinema);

    return () => {
      window.removeEventListener("cinema:scriptsLoaded", initCinema);
    };
  }, [brandName, accentColor, skipPreloader, sound]);

  return (
    <>
      {/* CDN Dependencies */}
      <Script
        src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"
        strategy="afterInteractive"
      />
      <Script src="https://unpkg.com/split-type" strategy="afterInteractive" />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"
        strategy="afterInteractive"
      />

      {/* Cinema Engine */}
      <Script
        src="/cinema/cinema-engine.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.dispatchEvent(new CustomEvent("cinema:scriptsLoaded"));
        }}
      />
    </>
  );
}

// Export Cinema-aware wrapper components
export function CinemaText({
  children,
  effect = "slide-up",
  className = "",
}: {
  children: ReactNode;
  effect?:
    | "slide-up"
    | "rotate-in"
    | "scroll-fade"
    | "scramble"
    | "wave"
    | "chars-up";
  className?: string;
}) {
  return (
    <div className={className} data-text={effect}>
      {children}
    </div>
  );
}

export function CinemaVelocity({
  children,
  effect = "skew",
  className = "",
}: {
  children: ReactNode;
  effect?:
    | "skew"
    | "blur"
    | "stretch"
    | "opacity"
    | "letterspace"
    | "rgb-split";
  className?: string;
}) {
  return (
    <div className={className} data-velocity={effect}>
      {children}
    </div>
  );
}

export function MagneticButton({
  children,
  strength = 0.3,
  className = "",
  href,
  onClick,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = <span data-magnetic-inner>{children}</span>;

  if (href) {
    return (
      <a href={href} className={className} data-magnetic={strength}>
        {content}
      </a>
    );
  }

  return (
    <button className={className} onClick={onClick} data-magnetic={strength}>
      {content}
    </button>
  );
}

export function CinemaReveal({
  children,
  variant = "default",
  className = "",
}: {
  children: ReactNode;
  variant?: "default" | "scale" | "clip";
  className?: string;
}) {
  if (variant === "default") {
    return (
      <div className={className} data-reveal="">
        {children}
      </div>
    );
  }
  return (
    <div className={className} data-reveal={variant}>
      {children}
    </div>
  );
}

export function CinemaRevealItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className} data-reveal-item="">
      {children}
    </div>
  );
}

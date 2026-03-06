"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";

// ============================================
// MACHINEMIND CINEMA ENGINE PRELOADER
// "Never skip the preloader"
// ============================================

interface PreloaderProps {
  /** Brand name to reveal letter by letter */
  brandName?: string;
  /** Duration of the counter animation in seconds */
  counterDuration?: number;
  /** Skip preloader if already seen this session */
  checkSession?: boolean;
  /** Callback when preloader completes */
  onComplete?: () => void;
  /** Gold accent color */
  accentColor?: string;
  /** Background color */
  bgColor?: string;
}

interface PreloaderState {
  isVisible: boolean;
  isComplete: boolean;
  hasSessionFlag: boolean;
}

const SESSION_KEY = "machinemind_preloader_seen";

export default function Preloader({
  brandName = "MACHINEMIND",
  counterDuration = 2.5,
  checkSession = true,
  onComplete,
  accentColor = "#c9a96e",
  bgColor = "#06060a",
}: PreloaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const [state, setState] = useState<PreloaderState>({
    isVisible: true,
    isComplete: false,
    hasSessionFlag: false,
  });

  // Check session storage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasSeenPreloader = sessionStorage.getItem(SESSION_KEY) === "true";

    if (checkSession && hasSeenPreloader) {
      setState((prev) => ({
        ...prev,
        isVisible: false,
        isComplete: true,
        hasSessionFlag: true,
      }));
      return;
    }

    // Prevent scroll during preloader
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [checkSession]);

  // Handle completion
  const handleComplete = useCallback(() => {
    // Set session flag
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_KEY, "true");
    }

    // Restore scroll
    document.body.style.overflow = "";

    setState((prev) => ({
      ...prev,
      isComplete: true,
    }));

    onComplete?.();
  }, [onComplete]);

  // Main animation sequence
  useEffect(() => {
    if (state.hasSessionFlag || state.isComplete) return;
    if (!containerRef.current || !counterRef.current || !brandRef.current || !overlayRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          // Hide after animation
          setTimeout(() => {
            setState((prev) => ({ ...prev, isVisible: false }));
            handleComplete();
          }, 100);
        },
      });

      timelineRef.current = tl;

      // Counter object for animation
      const counter = { value: 0 };

      // Phase 1: Counter animation (0 -> 100)
      tl.to(counter, {
        value: 100,
        duration: counterDuration,
        ease: "power2.inOut",
        onUpdate: () => {
          if (counterRef.current) {
            counterRef.current.textContent = Math.round(counter.value).toString().padStart(3, "0");
          }
        },
      });

      // Phase 2: Brand text reveal (letter by letter, starts at 0.3s)
      const letters = brandRef.current?.querySelectorAll(".preloader-letter");
      if (letters && letters.length > 0) {
        tl.fromTo(
          letters,
          {
            opacity: 0,
            y: 20,
            rotateX: -90,
          },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 0.08,
            stagger: 0.05,
            ease: "power2.out",
          },
          0.3 // Start at 0.3 seconds
        );
      }

      // Phase 3: Counter scale and fade (starts near end)
      tl.to(
        counterRef.current,
        {
          scale: 1.2,
          opacity: 0,
          duration: 0.4,
          ease: "power2.in",
        },
        counterDuration - 0.3
      );

      // Phase 4: Clip-path circle transition from center outward
      tl.to(
        overlayRef.current,
        {
          clipPath: "circle(150% at 50% 50%)",
          duration: 0.8,
          ease: "power3.inOut",
        },
        counterDuration + 0.2
      );

      // Phase 5: Brand text exit
      if (letters && letters.length > 0) {
        tl.to(
          letters,
          {
            opacity: 0,
            y: -30,
            duration: 0.3,
            stagger: 0.02,
            ease: "power2.in",
          },
          counterDuration + 0.3
        );
      }

      // Phase 6: Final fade out of container
      tl.to(
        containerRef.current,
        {
          opacity: 0,
          duration: 0.3,
          ease: "power2.out",
        },
        "+=0.1"
      );
    }, containerRef);

    return () => {
      ctx.revert();
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [state.hasSessionFlag, state.isComplete, counterDuration, handleComplete]);

  // Don't render if already seen
  if (!state.isVisible || state.hasSessionFlag) {
    return null;
  }

  // Split brand name into letters
  const brandLetters = brandName.split("");

  return (
    <div
      ref={containerRef}
      className="preloader-container"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: bgColor,
        pointerEvents: "all",
      }}
      aria-label="Loading"
      role="progressbar"
      aria-valuenow={0}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Circle clip-path overlay */}
      <div
        ref={overlayRef}
        style={{
          position: "absolute",
          inset: 0,
          background: bgColor,
          clipPath: "circle(0% at 50% 50%)",
          zIndex: 1,
        }}
      />

      {/* Counter */}
      <span
        ref={counterRef}
        className="preloader-counter"
        style={{
          fontFamily: "var(--cinema-font-display, 'Clash Display', var(--font-outfit), sans-serif)",
          fontSize: "clamp(4rem, 15vw, 10rem)",
          fontWeight: 600,
          color: accentColor,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
          lineHeight: 1,
          marginBottom: "2rem",
          position: "relative",
          zIndex: 2,
        }}
      >
        000
      </span>

      {/* Brand text with letter-by-letter reveal */}
      <div
        ref={brandRef}
        className="preloader-brand"
        style={{
          display: "flex",
          gap: "0.1em",
          perspective: "1000px",
          position: "relative",
          zIndex: 2,
        }}
      >
        {brandLetters.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            className="preloader-letter"
            style={{
              fontFamily: "var(--cinema-font-display, 'Clash Display', var(--font-outfit), sans-serif)",
              fontSize: "clamp(1rem, 3vw, 1.5rem)",
              fontWeight: 500,
              color: "rgba(255, 255, 255, 0.9)",
              letterSpacing: "0.3em",
              display: "inline-block",
              transformStyle: "preserve-3d",
              opacity: 0,
            }}
          >
            {letter}
          </span>
        ))}
      </div>

      {/* Subtle glow effect behind counter */}
      <div
        style={{
          position: "absolute",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Preloader styles */}
      <style jsx>{`
        .preloader-container {
          will-change: opacity;
        }
        .preloader-counter {
          will-change: transform, opacity;
        }
        .preloader-letter {
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
}

// Export types for external use
export type { PreloaderProps, PreloaderState };

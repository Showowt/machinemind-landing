"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingSequenceProps {
  onComplete: () => void;
  skipDelay?: number;
}

// Detect mobile device
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || "ontouchstart" in window;
}

// Detect reduced motion preference
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function LoadingSequence({
  onComplete,
  skipDelay = 2500, // Reduced to 2.5 seconds for launch
}: LoadingSequenceProps) {
  const [phase, setPhase] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if already loaded this session - instant skip
    if (sessionStorage.getItem("mm-loaded")) {
      onComplete();
      return;
    }

    // Check for reduced motion - skip animation entirely
    if (prefersReducedMotion()) {
      sessionStorage.setItem("mm-loaded", "true");
      onComplete();
      return;
    }

    const mobile = isMobileDevice();
    setIsMobile(mobile);

    // Even faster on mobile (1.5s vs 2.5s)
    const mobileMultiplier = mobile ? 0.6 : 1;
    const adjustedSkipDelay = skipDelay * mobileMultiplier;

    // Fast phase progression - all complete in ~2 seconds
    const phases = [100, 400, 700, 1000, 1300].map((t) =>
      Math.round(t * mobileMultiplier),
    );
    phases.forEach((delay, i) => {
      setTimeout(() => setPhase(i + 1), delay);
    });

    // Enable skip immediately
    setTimeout(() => setCanSkip(true), 200);

    // Auto-complete faster
    setTimeout(() => {
      sessionStorage.setItem("mm-loaded", "true");
      onComplete();
    }, adjustedSkipDelay);
  }, [onComplete, skipDelay]);

  const handleSkip = () => {
    if (canSkip) {
      sessionStorage.setItem("mm-loaded", "true");
      onComplete();
    }
  };

  // Particle count based on device
  const particleCount = isMobile ? 8 : 20;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-[var(--mm-void)] flex items-center justify-center"
        initial={{ opacity: 1 }}
        exit={{
          opacity: 0,
          transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
        }}
        onClick={handleSkip}
      >
        {/* Neural particles background */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: particleCount }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-[var(--mm-blue-core)]"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 0.5, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* Main content */}
        <div className="relative text-center px-4">
          {/* Singularity Ring Animation */}
          <div className="relative w-28 h-28 md:w-40 md:h-40 mx-auto mb-6 md:mb-8">
            {/* Outer ring */}
            <motion.svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 160 160"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={phase >= 1 ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="rgba(0,180,255,0.25)"
                strokeWidth="1.5"
              />
            </motion.svg>

            {/* Core singularity */}
            <motion.div
              className="absolute top-1/2 left-1/2 w-3 h-3 md:w-4 md:h-4 -translate-x-1/2 -translate-y-1/2 bg-[var(--mm-blue-core)]"
              initial={{ opacity: 0, scale: 0 }}
              animate={
                phase >= 2
                  ? {
                      opacity: 1,
                      scale: [0, 1.2, 1],
                    }
                  : {}
              }
              transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            />

            {/* MM Monogram */}
            <motion.svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 160 160"
              initial={{ opacity: 0 }}
              animate={phase >= 2 ? { opacity: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {/* Blue M */}
              <motion.path
                d="M 50 100 L 50 60 L 65 80 L 80 60 L 80 100"
                fill="none"
                stroke="#00B4FF"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={phase >= 2 ? { pathLength: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              />
              {/* White M */}
              <motion.path
                d="M 80 100 L 80 60 L 95 80 L 110 60 L 110 100"
                fill="none"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={phase >= 2 ? { pathLength: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
              />
            </motion.svg>
          </div>

          {/* Wordmark */}
          <motion.div
            className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
          >
            <span className="text-[#00B4FF]">Machine</span>
            <span className="text-white">Mind</span>
          </motion.div>

          {/* Tagline */}
          <motion.p
            className="text-muted text-base md:text-lg lg:text-xl mb-8 md:mb-12 font-mono tracking-wider uppercase"
            initial={{ opacity: 0 }}
            animate={phase >= 4 ? { opacity: 1 } : {}}
            transition={{ duration: 0.6 }}
          >
            Self-Sustaining Intelligence
          </motion.p>

          {/* Progress bar */}
          <motion.div
            className="w-32 md:w-48 h-[2px] bg-[var(--mm-border)] mx-auto overflow-hidden"
            initial={{ opacity: 0 }}
            animate={phase >= 3 ? { opacity: 1 } : {}}
          >
            <motion.div
              className="h-full bg-[var(--mm-blue-core)]"
              initial={{ width: "0%" }}
              animate={phase >= 3 ? { width: "100%" } : {}}
              transition={{ duration: isMobile ? 0.8 : 1.2, ease: "linear" }}
            />
          </motion.div>

          {/* Skip hint */}
          <motion.p
            className="text-xs text-muted mt-6 md:mt-8 font-mono min-h-[44px] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={canSkip ? { opacity: 0.5 } : {}}
            transition={{ duration: 0.5 }}
          >
            Tap anywhere to skip
          </motion.p>
        </div>

        {/* Corner decoration - hidden on mobile for cleaner look */}
        <motion.div
          className="hidden md:block absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-[var(--mm-blue-core)] opacity-20"
          initial={{ scale: 0 }}
          animate={phase >= 4 ? { scale: 1 } : {}}
          transition={{ duration: 0.4 }}
        />
        <motion.div
          className="hidden md:block absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-[var(--mm-blue-core)] opacity-20"
          initial={{ scale: 0 }}
          animate={phase >= 4 ? { scale: 1 } : {}}
          transition={{ duration: 0.4 }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

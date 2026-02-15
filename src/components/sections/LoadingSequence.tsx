"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingSequenceProps {
  onComplete: () => void;
  skipDelay?: number;
}

export default function LoadingSequence({
  onComplete,
  skipDelay = 5000,
}: LoadingSequenceProps) {
  const [phase, setPhase] = useState(0);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    // Check if already loaded this session
    if (sessionStorage.getItem("mm-loaded")) {
      onComplete();
      return;
    }

    // Phase progression
    const phases = [500, 1500, 2500, 3500, 4500];
    phases.forEach((delay, i) => {
      setTimeout(() => setPhase(i + 1), delay);
    });

    // Enable skip after delay
    setTimeout(() => setCanSkip(true), 1000);

    // Auto-complete
    setTimeout(() => {
      sessionStorage.setItem("mm-loaded", "true");
      onComplete();
    }, skipDelay);
  }, [onComplete, skipDelay]);

  const handleSkip = () => {
    if (canSkip) {
      sessionStorage.setItem("mm-loaded", "true");
      onComplete();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-[var(--mm-void)] flex items-center justify-center"
        initial={{ opacity: 1 }}
        exit={{
          opacity: 0,
          transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
        }}
        onClick={handleSkip}
      >
        {/* Neural particles background */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
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
        <div className="relative text-center">
          {/* Singularity Ring Animation */}
          <div className="relative w-40 h-40 mx-auto mb-8">
            {/* Outer ring */}
            <motion.svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 160 160"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={phase >= 1 ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
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
              className="absolute top-1/2 left-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 bg-[var(--mm-blue-core)]"
              initial={{ opacity: 0, scale: 0 }}
              animate={
                phase >= 2
                  ? {
                      opacity: 1,
                      scale: [0, 1.2, 1],
                    }
                  : {}
              }
              transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
            />

            {/* MM Monogram */}
            <motion.svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 160 160"
              initial={{ opacity: 0 }}
              animate={phase >= 2 ? { opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
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
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
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
                transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
              />
            </motion.svg>
          </div>

          {/* Wordmark */}
          <motion.div
            className="font-heading text-4xl md:text-5xl font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <span className="text-[#00B4FF]">Machine</span>
            <span className="text-white">Mind</span>
          </motion.div>

          {/* Tagline */}
          <motion.p
            className="text-muted text-lg md:text-xl mb-12 font-mono tracking-wider uppercase"
            initial={{ opacity: 0 }}
            animate={phase >= 4 ? { opacity: 1 } : {}}
            transition={{ duration: 0.8 }}
          >
            Self-Sustaining Intelligence
          </motion.p>

          {/* Progress bar */}
          <motion.div
            className="w-48 h-[2px] bg-[var(--mm-border)] mx-auto overflow-hidden"
            initial={{ opacity: 0 }}
            animate={phase >= 3 ? { opacity: 1 } : {}}
          >
            <motion.div
              className="h-full bg-[var(--mm-blue-core)]"
              initial={{ width: "0%" }}
              animate={phase >= 3 ? { width: "100%" } : {}}
              transition={{ duration: 2, ease: "linear" }}
            />
          </motion.div>

          {/* Skip hint */}
          <motion.p
            className="text-xs text-muted mt-8 font-mono"
            initial={{ opacity: 0 }}
            animate={canSkip ? { opacity: 0.5 } : {}}
            transition={{ duration: 0.5 }}
          >
            Click anywhere to skip
          </motion.p>
        </div>

        {/* Corner decoration - hex style */}
        <motion.div
          className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-[var(--mm-blue-core)] opacity-20"
          initial={{ scale: 0 }}
          animate={phase >= 4 ? { scale: 1 } : {}}
          transition={{ duration: 0.5 }}
        />
        <motion.div
          className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-[var(--mm-blue-core)] opacity-20"
          initial={{ scale: 0 }}
          animate={phase >= 4 ? { scale: 1 } : {}}
          transition={{ duration: 0.5 }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

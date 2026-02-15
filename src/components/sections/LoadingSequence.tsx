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
        className="fixed inset-0 z-[100] bg-[var(--mm-background)] flex items-center justify-center"
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
              className="absolute w-1 h-1 bg-[var(--mm-gold)]"
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
          {/* Logo */}
          <div className="font-heading text-5xl md:text-7xl font-bold mb-8">
            <motion.span
              className="inline-block text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
            >
              {"Machine".split("").map((char, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ opacity: 0, y: 20 }}
                  animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.4,
                    delay: i * 0.05,
                    ease: [0.25, 0.4, 0.25, 1],
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.span>
            <motion.span
              className="inline-block text-gold"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 2 ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.25, 0.4, 0.25, 1],
              }}
            >
              {"Mind".split("").map((char, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ opacity: 0, y: 20 }}
                  animate={phase >= 2 ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    duration: 0.4,
                    delay: 0.4 + i * 0.05,
                    ease: [0.25, 0.4, 0.25, 1],
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.span>
          </div>

          {/* Tagline */}
          <motion.p
            className="text-muted text-lg md:text-xl mb-12"
            initial={{ opacity: 0 }}
            animate={phase >= 3 ? { opacity: 1 } : {}}
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
              className="h-full bg-[var(--mm-gold)]"
              initial={{ width: "0%" }}
              animate={phase >= 3 ? { width: "100%" } : {}}
              transition={{ duration: 2, ease: "linear" }}
            />
          </motion.div>

          {/* Skip hint */}
          <motion.p
            className="text-xs text-muted mt-8"
            initial={{ opacity: 0 }}
            animate={canSkip ? { opacity: 0.5 } : {}}
            transition={{ duration: 0.5 }}
          >
            Click anywhere to skip
          </motion.p>
        </div>

        {/* Corner decoration */}
        <motion.div
          className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-[var(--mm-gold)] opacity-20"
          initial={{ scale: 0 }}
          animate={phase >= 4 ? { scale: 1 } : {}}
          transition={{ duration: 0.5 }}
        />
        <motion.div
          className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-[var(--mm-gold)] opacity-20"
          initial={{ scale: 0 }}
          animate={phase >= 4 ? { scale: 1 } : {}}
          transition={{ duration: 0.5 }}
        />
      </motion.div>
    </AnimatePresence>
  );
}

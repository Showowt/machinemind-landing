"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useAnimation } from "framer-motion";

interface TextRevealProps {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
  splitBy?: "char" | "word";
  once?: boolean;
}

export default function TextReveal({
  text,
  className = "",
  delay = 0,
  staggerDelay = 0.03,
  splitBy = "char",
  once = true,
}: TextRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once, amount: 0.5 });
  const controls = useAnimation();

  const parts = splitBy === "char" ? text.split("") : text.split(" ");

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return (
    <span ref={ref} className={`inline-block ${className}`}>
      {parts.map((part, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial="hidden"
          animate={controls}
          variants={{
            hidden: {
              opacity: 0,
              y: 20,
              rotateX: -90,
            },
            visible: {
              opacity: 1,
              y: 0,
              rotateX: 0,
            },
          }}
          transition={{
            duration: 0.5,
            delay: delay + i * staggerDelay,
            ease: [0.25, 0.4, 0.25, 1],
          }}
        >
          {part}
          {splitBy === "word" && i < parts.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}

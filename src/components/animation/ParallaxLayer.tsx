"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface ParallaxLayerProps {
  children: ReactNode;
  speed?: number; // 0.5 = half speed (behind), 1.5 = faster (foreground)
  className?: string;
  offset?: number;
}

export default function ParallaxLayer({
  children,
  speed = 0.5,
  className = "",
  offset = 0,
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Calculate parallax offset based on speed
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [offset - 100 * speed, offset + 100 * speed],
  );

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

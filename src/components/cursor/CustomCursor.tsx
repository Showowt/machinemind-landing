"use client";

import { useEffect, useRef, useState } from "react";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Mouse position refs for RAF
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const dotX = useRef(0);
  const dotY = useRef(0);
  const ringX = useRef(0);
  const ringY = useRef(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Check for touch device using pointer: coarse media query
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;

    setIsVisible(true);

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.current = e.clientX;
      mouseY.current = e.clientY;
    };

    const handleMouseEnter = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.closest("a") ||
        target.closest("button") ||
        target.hasAttribute("data-magnetic") ||
        target.closest("[data-magnetic]") ||
        target.dataset.cursor === "hover"
      ) {
        setIsHovering(true);
      }
    };

    const handleMouseLeave = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.closest("a") ||
        target.closest("button") ||
        target.hasAttribute("data-magnetic") ||
        target.closest("[data-magnetic]") ||
        target.dataset.cursor === "hover"
      ) {
        setIsHovering(false);
      }
    };

    const animate = () => {
      // Dot follows cursor exactly (no lerp)
      dotX.current = mouseX.current;
      dotY.current = mouseY.current;

      // Ring follows with lerp (slight lag)
      const lerpFactor = 0.15;
      ringX.current += (mouseX.current - ringX.current) * lerpFactor;
      ringY.current += (mouseY.current - ringY.current) * lerpFactor;

      // Apply transforms
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${dotX.current}px, ${dotY.current}px) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringX.current}px, ${ringY.current}px) translate(-50%, -50%)`;
      }

      rafId.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseover", handleMouseEnter);
    document.addEventListener("mouseout", handleMouseLeave);

    // Start animation loop
    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseEnter);
      document.removeEventListener("mouseout", handleMouseLeave);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // Hide on touch devices
  if (!isVisible) return null;

  return (
    <>
      {/* Gold dot - follows cursor exactly */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          width: isHovering ? 12 : 6,
          height: isHovering ? 12 : 6,
          backgroundColor: "#c9a96e",
          borderRadius: "50%",
          mixBlendMode: "difference",
          transition: "width 0.2s ease, height 0.2s ease",
          willChange: "transform",
        }}
      />

      {/* Ring - follows with slight lag */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 pointer-events-none z-[9998]"
        style={{
          width: isHovering ? 48 : 36,
          height: isHovering ? 48 : 36,
          border: "1px solid #c9a96e",
          borderRadius: "50%",
          mixBlendMode: "difference",
          transition: "width 0.2s ease, height 0.2s ease",
          willChange: "transform",
        }}
      />

      {/* Hide default cursor globally */}
      <style jsx global>{`
        @media (pointer: fine) {
          * {
            cursor: none !important;
          }
        }
      `}</style>
    </>
  );
}

"use client";

import { type ReactNode } from "react";

interface SmoothScrollProps {
  children: ReactNode;
}

/**
 * SmoothScroll Wrapper (DEPRECATED)
 * 
 * NOTE: Smooth scroll is now handled by CinemaEngine.tsx which provides:
 * - Lenis smooth scroll with cinematic settings
 * - GSAP ScrollTrigger integration
 * - Global window.lenis access
 * 
 * This component is kept for backwards compatibility but simply renders children.
 * DO NOT use this alongside CinemaEngine to avoid duplicate Lenis instances.
 */
export default function SmoothScroll({ children }: SmoothScrollProps) {
  // CinemaEngine handles all smooth scroll functionality
  // This wrapper is a no-op passthrough for backwards compatibility
  return <>{children}</>;
}

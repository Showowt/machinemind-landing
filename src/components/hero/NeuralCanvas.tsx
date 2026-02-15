"use client";

import { useEffect, useRef, useState } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  pulse: number;
  pulseSpeed: number;
  connections: number[];
}

interface NeuralCanvasProps {
  nodeCount?: number;
  connectionDistance?: number;
}

// Detect if device prefers reduced motion
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Detect mobile device
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || "ontouchstart" in window;
}

export default function NeuralCanvas({
  nodeCount = 45,
  connectionDistance = 140,
}: NeuralCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    if (prefersReducedMotion()) {
      setIsReady(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mobile optimization: reduce particle count and connection distance
    const isMobile = isMobileDevice();
    const actualNodeCount = isMobile ? Math.min(20, nodeCount) : nodeCount;
    const actualConnectionDistance = isMobile
      ? Math.min(100, connectionDistance)
      : connectionDistance;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Track mouse (only on desktop)
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMobile) {
        mouseRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    if (!isMobile) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    // Create nodes
    const createNode = (): Node => {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.02,
        connections: [],
      };
    };

    // Initialize nodes
    nodesRef.current = Array.from({ length: actualNodeCount }, () =>
      createNode(),
    );

    // Blue core brand color (#00B4FF)
    const blueCore = { r: 0, g: 180, b: 255 };

    // Pre-calculate gradient (optimization)
    let lastFrameTime = 0;
    const targetFPS = isMobile ? 30 : 60;
    const frameInterval = 1000 / targetFPS;

    // Animation loop
    const animate = (currentTime: number) => {
      // Throttle FPS on mobile
      const elapsed = currentTime - lastFrameTime;
      if (elapsed < frameInterval) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = currentTime - (elapsed % frameInterval);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const nodes = nodesRef.current;
      const mouse = mouseRef.current;

      // Update and draw connections first (behind nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < actualConnectionDistance) {
            const opacity = (1 - distance / actualConnectionDistance) * 0.3;

            // Draw connection line
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(${blueCore.r}, ${blueCore.g}, ${blueCore.b}, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Update and draw nodes
      nodes.forEach((node) => {
        // Update pulse
        node.pulse += node.pulseSpeed;

        // Mouse attraction/repulsion (desktop only)
        if (!isMobile) {
          const dx = mouse.x - node.x;
          const dy = mouse.y - node.y;
          const mouseDistance = Math.sqrt(dx * dx + dy * dy);

          if (mouseDistance < 200 && mouseDistance > 0) {
            // Gentle attraction
            const force = (200 - mouseDistance) / 200;
            node.vx += (dx / mouseDistance) * force * 0.01;
            node.vy += (dy / mouseDistance) * force * 0.01;
          }
        }

        // Apply velocity with damping
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.99;
        node.vy *= 0.99;

        // Bounce off edges with padding
        const padding = 50;
        if (node.x < padding || node.x > canvas.width - padding) {
          node.vx *= -1;
          node.x = Math.max(padding, Math.min(canvas.width - padding, node.x));
        }
        if (node.y < padding || node.y > canvas.height - padding) {
          node.vy *= -1;
          node.y = Math.max(padding, Math.min(canvas.height - padding, node.y));
        }

        // Calculate pulse glow
        const pulseGlow = 0.5 + Math.sin(node.pulse) * 0.3;

        // Simplified glow on mobile (no gradient)
        if (isMobile) {
          // Simple circle glow
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${blueCore.r}, ${blueCore.g}, ${blueCore.b}, ${pulseGlow * 0.3})`;
          ctx.fill();
        } else {
          // Draw outer glow with gradient (desktop)
          const gradient = ctx.createRadialGradient(
            node.x,
            node.y,
            0,
            node.x,
            node.y,
            node.size * 4,
          );
          gradient.addColorStop(
            0,
            `rgba(${blueCore.r}, ${blueCore.g}, ${blueCore.b}, ${pulseGlow * 0.5})`,
          );
          gradient.addColorStop(
            0.5,
            `rgba(${blueCore.r}, ${blueCore.g}, ${blueCore.b}, ${pulseGlow * 0.2})`,
          );
          gradient.addColorStop(1, "rgba(0, 180, 255, 0)");

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.size * 4, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Draw node core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${blueCore.r}, ${blueCore.g}, ${blueCore.b}, ${0.8 + pulseGlow * 0.2})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    setIsReady(true);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      if (!isMobile) {
        window.removeEventListener("mousemove", handleMouseMove);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodeCount, connectionDistance]);

  // For reduced motion, show static dots
  if (prefersReducedMotion()) {
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1 }}
        aria-hidden="true"
      >
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-[var(--mm-blue-core)] opacity-30"
            style={{
              left: `${10 + i * 6}%`,
              top: `${15 + ((i * 5) % 70)}%`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1, opacity: isReady ? 1 : 0 }}
      aria-hidden="true"
    />
  );
}

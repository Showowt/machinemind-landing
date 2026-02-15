"use client";

import { useEffect, useRef } from "react";

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

export default function NeuralCanvas({
  nodeCount = 40,
  connectionDistance = 150,
}: NeuralCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Track mouse
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Create nodes
    const createNode = (index: number): Node => {
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
    nodesRef.current = Array.from({ length: nodeCount }, (_, i) =>
      createNode(i),
    );

    // Cyan brand color
    const cyanColor = { r: 0, g: 166, b: 237 };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const nodes = nodesRef.current;
      const mouse = mouseRef.current;

      // Update and draw connections first (behind nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.3;

            // Draw connection line
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(${cyanColor.r}, ${cyanColor.g}, ${cyanColor.b}, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Update and draw nodes
      nodes.forEach((node) => {
        // Update pulse
        node.pulse += node.pulseSpeed;

        // Mouse attraction/repulsion
        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        const mouseDistance = Math.sqrt(dx * dx + dy * dy);

        if (mouseDistance < 200 && mouseDistance > 0) {
          // Gentle attraction
          const force = (200 - mouseDistance) / 200;
          node.vx += (dx / mouseDistance) * force * 0.01;
          node.vy += (dy / mouseDistance) * force * 0.01;
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

        // Draw outer glow
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
          `rgba(${cyanColor.r}, ${cyanColor.g}, ${cyanColor.b}, ${pulseGlow * 0.5})`,
        );
        gradient.addColorStop(
          0.5,
          `rgba(${cyanColor.r}, ${cyanColor.g}, ${cyanColor.b}, ${pulseGlow * 0.2})`,
        );
        gradient.addColorStop(1, "rgba(0, 166, 237, 0)");

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw node core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cyanColor.r}, ${cyanColor.g}, ${cyanColor.b}, ${0.8 + pulseGlow * 0.2})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodeCount, connectionDistance]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    />
  );
}

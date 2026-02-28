"use client";

import { useEffect, useRef } from "react";

/**
 * Three.js Particle System - Hero Background
 * MachineMind Brand Colors - WORLD CLASS
 * Floating particles that respond to scroll and mouse
 */
export default function ThreeParticles() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    if (typeof window === "undefined") return;

    // Wait for Three.js to load
    const checkThree = setInterval(() => {
      if ((window as unknown as { THREE?: unknown }).THREE) {
        clearInterval(checkThree);
        initParticles();
      }
    }, 100);

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      clearInterval(checkThree);
    }, 5000);

    const initParticles = () => {
      if (initialized.current) return;
      initialized.current = true;

      const THREE = (window as unknown as { THREE: typeof import("three") })
        .THREE;
      const container = containerRef.current;
      if (!container) return;

      // Scene setup
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
      camera.position.z = 50;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Particle system - MachineMind blue spectrum
      const particleCount = window.innerWidth < 768 ? 600 : 1500;
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 100;
        positions[i3 + 1] = (Math.random() - 0.5) * 100;
        positions[i3 + 2] = (Math.random() - 0.5) * 50;

        velocities[i3] = (Math.random() - 0.5) * 0.015;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.015;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.015;

        // MachineMind blue spectrum: #00B4FF to #00D4FF
        const t = Math.random();
        colors[i3] = 0; // R
        colors[i3 + 1] = 0.7 + t * 0.13; // G: 180-212
        colors[i3 + 2] = 1; // B: 255

        sizes[i] = Math.random() * 2 + 0.5;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        size: 0.12,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // Connection lines geometry
      const lineGeometry = new THREE.BufferGeometry();
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00b4ff,
        transparent: true,
        opacity: 0.08,
      });
      const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
      scene.add(lines);

      // Mouse tracking
      let mouseX = 0;
      let mouseY = 0;
      let scrollY = 0;
      let targetX = 0;
      let targetY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        targetX = (e.clientX / window.innerWidth) * 2 - 1;
        targetY = -(e.clientY / window.innerHeight) * 2 + 1;
      };

      const handleScroll = () => {
        scrollY = window.scrollY / window.innerHeight;
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("scroll", handleScroll, { passive: true });

      // Animation loop
      let animationId: number;
      let time = 0;

      const animate = () => {
        animationId = requestAnimationFrame(animate);
        time += 0.001;

        // Smooth mouse follow
        mouseX += (targetX - mouseX) * 0.05;
        mouseY += (targetY - mouseY) * 0.05;

        const posArr = geometry.attributes.position.array as Float32Array;
        const linePositions: number[] = [];

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;

          // Update positions with velocity
          posArr[i3] += velocities[i3];
          posArr[i3 + 1] += velocities[i3 + 1];
          posArr[i3 + 2] += velocities[i3 + 2];

          // Bounds check with soft bounce
          if (Math.abs(posArr[i3]) > 50) velocities[i3] *= -0.9;
          if (Math.abs(posArr[i3 + 1]) > 50) velocities[i3 + 1] *= -0.9;
          if (Math.abs(posArr[i3 + 2]) > 25) velocities[i3 + 2] *= -0.9;

          // Connection lines (check every 5th particle for performance)
          if (i % 5 === 0) {
            for (let j = i + 5; j < particleCount; j += 5) {
              const j3 = j * 3;
              const dx = posArr[i3] - posArr[j3];
              const dy = posArr[i3 + 1] - posArr[j3 + 1];
              const dz = posArr[i3 + 2] - posArr[j3 + 2];
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

              if (dist < 15 && linePositions.length < 3000) {
                linePositions.push(posArr[i3], posArr[i3 + 1], posArr[i3 + 2]);
                linePositions.push(posArr[j3], posArr[j3 + 1], posArr[j3 + 2]);
              }
            }
          }
        }

        geometry.attributes.position.needsUpdate = true;

        // Update line geometry
        lineGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(linePositions, 3),
        );

        // Camera responds to mouse and scroll
        camera.position.x += (mouseX * 8 - camera.position.x) * 0.03;
        camera.position.y += (mouseY * 8 - camera.position.y) * 0.03;
        camera.rotation.z = Math.sin(time * 2) * 0.02 + scrollY * 0.05;

        // Gentle rotation
        particles.rotation.y = time * 0.3;
        particles.rotation.x = Math.sin(time) * 0.1;

        renderer.render(scene, camera);
      };
      animate();

      // Resize handler
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", handleResize);

      // Cleanup
      return () => {
        cancelAnimationFrame(animationId);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleResize);
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
        geometry.dispose();
        material.dispose();
        lineGeometry.dispose();
        lineMaterial.dispose();
        renderer.dispose();
      };
    };

    return () => {
      clearInterval(checkThree);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ pointerEvents: "none" }}
    />
  );
}

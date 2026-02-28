"use client";

import { useEffect, useRef } from "react";

/**
 * Three.js Particle System - Hero Background
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

      // Particle system
      const particleCount = window.innerWidth < 768 ? 800 : 2000;
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 100;
        positions[i3 + 1] = (Math.random() - 0.5) * 100;
        positions[i3 + 2] = (Math.random() - 0.5) * 50;

        velocities[i3] = (Math.random() - 0.5) * 0.02;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;

        // Color gradient: cyan to purple
        const t = Math.random();
        colors[i3] = 0 + t * 0.54; // R: 0 -> 139
        colors[i3 + 1] = 0.9 - t * 0.54; // G: 229 -> 92
        colors[i3 + 2] = 1; // B: 255
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // Connection lines
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.1,
      });

      // Mouse tracking
      let mouseX = 0;
      let mouseY = 0;
      let scrollY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      };

      const handleScroll = () => {
        scrollY = window.scrollY / window.innerHeight;
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("scroll", handleScroll, { passive: true });

      // Animation loop
      let animationId: number;
      const animate = () => {
        animationId = requestAnimationFrame(animate);

        const posArr = geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          posArr[i3] += velocities[i3];
          posArr[i3 + 1] += velocities[i3 + 1];
          posArr[i3 + 2] += velocities[i3 + 2];

          // Bounds
          if (Math.abs(posArr[i3]) > 50) velocities[i3] *= -1;
          if (Math.abs(posArr[i3 + 1]) > 50) velocities[i3 + 1] *= -1;
          if (Math.abs(posArr[i3 + 2]) > 25) velocities[i3 + 2] *= -1;
        }
        geometry.attributes.position.needsUpdate = true;

        // Camera responds to mouse and scroll
        camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
        camera.position.y += (mouseY * 5 - camera.position.y) * 0.05;
        camera.rotation.z = scrollY * 0.1;

        particles.rotation.y += 0.0005;
        particles.rotation.x += 0.0002;

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
        container.removeChild(renderer.domElement);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      };
    };

    return () => {
      clearInterval(checkThree);
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

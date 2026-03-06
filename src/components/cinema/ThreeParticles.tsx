"use client";

import { useEffect, useRef } from "react";

/**
 * Cinema Engine Hero Sphere
 * Wireframe IcosahedronGeometry with noise morphing
 * Mouse reactive + scroll reactive
 */

function noise3D(x: number, y: number, z: number, time: number): number {
  return (
    Math.sin(x * 2 + time) *
    Math.cos(y * 2 + time * 0.7) *
    Math.sin(z * 2 + time * 0.5) *
    0.15
  );
}

export default function ThreeParticles() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    if (typeof window === "undefined") return;

    const checkThree = setInterval(() => {
      if ((window as unknown as { THREE?: unknown }).THREE) {
        clearInterval(checkThree);
        initSphere();
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(checkThree);
      if (!initialized.current && containerRef.current) {
        console.warn(
          "[CinemaEngine] Three.js not loaded - using CSS gradient fallback"
        );
        containerRef.current.style.background =
          "radial-gradient(ellipse at 50% 50%, rgba(201, 169, 110, 0.08) 0%, transparent 50%), " +
          "radial-gradient(ellipse at 50% 50%, rgba(0, 229, 255, 0.05) 0%, transparent 40%)";
      }
    }, 5000);

    const initSphere = () => {
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
        1000
      );
      camera.position.z = 5;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      // Outer sphere - Gold wireframe
      const outerGeometry = new THREE.IcosahedronGeometry(1.5, 24);
      const outerMaterial = new THREE.MeshBasicMaterial({
        color: 0xc9a96e,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
      });
      const outerSphere = new THREE.Mesh(outerGeometry, outerMaterial);
      scene.add(outerSphere);

      // Store original positions for noise displacement
      const outerOriginalPositions = new Float32Array(
        outerGeometry.attributes.position.array.length
      );
      outerOriginalPositions.set(outerGeometry.attributes.position.array);

      // Inner sphere - Cyan wireframe (counter-rotating)
      const innerGeometry = new THREE.IcosahedronGeometry(0.8, 24);
      const innerMaterial = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      });
      const innerSphere = new THREE.Mesh(innerGeometry, innerMaterial);
      scene.add(innerSphere);

      // Store original positions for inner sphere
      const innerOriginalPositions = new Float32Array(
        innerGeometry.attributes.position.array.length
      );
      innerOriginalPositions.set(innerGeometry.attributes.position.array);

      // Group for mouse tilt
      const sphereGroup = new THREE.Group();
      sphereGroup.add(outerSphere);
      sphereGroup.add(innerSphere);
      scene.add(sphereGroup);

      // Remove individual spheres from scene (they're in group now)
      scene.remove(outerSphere);
      scene.remove(innerSphere);

      // Mouse tracking
      let mouseX = 0;
      let mouseY = 0;
      let targetMouseX = 0;
      let targetMouseY = 0;

      // Scroll tracking
      let scrollProgress = 0;
      let targetScrollProgress = 0;

      const handleMouseMove = (e: MouseEvent) => {
        targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
        targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      };

      const handleScroll = () => {
        const heroHeight = window.innerHeight;
        targetScrollProgress = Math.min(window.scrollY / heroHeight, 1);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("scroll", handleScroll, { passive: true });

      // Animation
      let animationId: number;
      let time = 0;

      const animate = () => {
        animationId = requestAnimationFrame(animate);
        time += 0.008;

        // Smooth mouse interpolation
        mouseX += (targetMouseX - mouseX) * 0.05;
        mouseY += (targetMouseY - mouseY) * 0.05;

        // Smooth scroll interpolation
        scrollProgress += (targetScrollProgress - scrollProgress) * 0.08;

        // Update outer sphere vertices with noise
        const outerPos = outerGeometry.attributes.position;
        for (let i = 0; i < outerPos.count; i++) {
          const i3 = i * 3;
          const ox = outerOriginalPositions[i3];
          const oy = outerOriginalPositions[i3 + 1];
          const oz = outerOriginalPositions[i3 + 2];

          const displacement = noise3D(ox, oy, oz, time);
          const length = Math.sqrt(ox * ox + oy * oy + oz * oz);
          const normalizedX = ox / length;
          const normalizedY = oy / length;
          const normalizedZ = oz / length;

          outerPos.setXYZ(
            i,
            ox + normalizedX * displacement,
            oy + normalizedY * displacement,
            oz + normalizedZ * displacement
          );
        }
        outerPos.needsUpdate = true;

        // Update inner sphere vertices with noise (different phase)
        const innerPos = innerGeometry.attributes.position;
        for (let i = 0; i < innerPos.count; i++) {
          const i3 = i * 3;
          const ox = innerOriginalPositions[i3];
          const oy = innerOriginalPositions[i3 + 1];
          const oz = innerOriginalPositions[i3 + 2];

          const displacement = noise3D(ox, oy, oz, time + 1.5) * 0.8;
          const length = Math.sqrt(ox * ox + oy * oy + oz * oz);
          const normalizedX = ox / length;
          const normalizedY = oy / length;
          const normalizedZ = oz / length;

          innerPos.setXYZ(
            i,
            ox + normalizedX * displacement,
            oy + normalizedY * displacement,
            oz + normalizedZ * displacement
          );
        }
        innerPos.needsUpdate = true;

        // Smooth rotation
        outerSphere.rotation.y += 0.002;
        outerSphere.rotation.x += 0.001;

        // Counter-rotation for inner sphere
        innerSphere.rotation.y -= 0.003;
        innerSphere.rotation.x -= 0.0015;

        // Mouse reactive tilt (sphere tilts toward cursor)
        const maxTilt = 0.3;
        sphereGroup.rotation.y += (mouseX * maxTilt - sphereGroup.rotation.y) * 0.05;
        sphereGroup.rotation.x += (-mouseY * maxTilt - sphereGroup.rotation.x) * 0.05;

        // Scroll reactive: scale down and fade
        const minScale = 0.6;
        const scale = 1 - scrollProgress * (1 - minScale);
        sphereGroup.scale.setScalar(scale);

        // Fade opacity on scroll
        const minOpacity = 0.02;
        outerMaterial.opacity = 0.08 - scrollProgress * (0.08 - minOpacity);
        innerMaterial.opacity = 0.15 - scrollProgress * (0.15 - minOpacity);

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
        outerGeometry.dispose();
        outerMaterial.dispose();
        innerGeometry.dispose();
        innerMaterial.dispose();
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
      className="absolute inset-0 z-0 flex items-center justify-center"
      style={{ pointerEvents: "none" }}
    />
  );
}

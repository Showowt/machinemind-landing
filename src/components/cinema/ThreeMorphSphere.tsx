"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeMorphSphere() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.85;
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Outer gold wireframe
    const geo = new THREE.IcosahedronGeometry(1.7, 2);
    const basePos = new Float32Array(geo.attributes.position.array);

    const mat = new THREE.MeshBasicMaterial({
      color: 0xc9a96e,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // Inner cyan accent
    const innerGeo = new THREE.IcosahedronGeometry(1.25, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.05,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerMesh);

    function noise3D(x: number, y: number, z: number) {
      return (
        Math.sin(x * 1.4 + z) *
        Math.cos(y * 1.4 + x) *
        Math.sin(z * 1.4 + y)
      );
    }

    let mouseX = 0,
      mouseY = 0,
      scrollP = 0;
    const onMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onScroll = () => {
      scrollP =
        window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight || 1);
    };
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("scroll", onScroll, { passive: true });

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = performance.now() * 0.00022;
      const pos = geo.attributes.position;
      const arr = pos.array as Float32Array;

      for (let i = 0; i < pos.count; i++) {
        const ox = basePos[i * 3],
          oy = basePos[i * 3 + 1],
          oz = basePos[i * 3 + 2];
        const n = noise3D(ox + t, oy + t * 0.65, oz + t * 1.15);
        const d = 0.1 + scrollP * 0.22;
        arr[i * 3] = ox + ox * n * d;
        arr[i * 3 + 1] = oy + oy * n * d;
        arr[i * 3 + 2] = oz + oz * n * d;
      }
      pos.needsUpdate = true;

      mesh.rotation.y = t * 0.42 + mouseX * 0.22;
      mesh.rotation.x = t * 0.26 + mouseY * 0.15;
      innerMesh.rotation.y = -t * 0.26;
      innerMesh.rotation.x = -t * 0.18;

      mat.opacity = 0.22 + scrollP * 0.08;
      innerMat.opacity = 0.05 + scrollP * 0.03;

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const s = Math.min(window.innerWidth, window.innerHeight) * 0.85;
      renderer.setSize(s, s);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
      geo.dispose();
      innerGeo.dispose();
      mat.dispose();
      innerMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: "50%",
        right: "clamp(-80px, -5vw, -40px)",
        transform: "translateY(-50%)",
        width: "min(75vmin, 680px)",
        height: "min(75vmin, 680px)",
        zIndex: 0,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    />
  );
}

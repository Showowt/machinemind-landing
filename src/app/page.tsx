'use client';

import { useEffect, useRef, useState } from 'react';
import type * as ThreeTypes from 'three';

// ═══════════════════════════════════════════════════════════════════════════
// MACHINEMIND — #1 AI AUTOMATION CONSULTANCY
// Canvas Frame Sequence (Apple technique) + Three.js Particles
// Lenis Smooth Scroll + GSAP + GPU Compositing
// ═══════════════════════════════════════════════════════════════════════════

const TOTAL_FRAMES = 150;
const FRAME_PATH = (i: number) => `/frames/frame-${String(i).padStart(4, '0')}.jpg`;

interface Project {
  name: string; type: string; industry: string;
  desc: string; color: string; tag?: string; url?: string;
}

const PROJECTS: Project[] = [
  { name: 'AEGIS Shield', type: 'Defense & Access Control', industry: 'Defense', desc: 'USMC DBIDS overlay — biometric gate control, AI threat scoring, command mesh', color: '#1c4a5e', tag: 'CLASSIFIED' },
  { name: 'VoxLink', type: 'Voice Intelligence Platform', industry: 'Enterprise', desc: 'Real-time voice AI with Daily.co, conversation analytics, Stripe billing', color: '#7c3aed', url: 'https://voxlink.vercel.app' },
  { name: 'MovVia', type: 'Logistics Command Center', industry: 'Operations', desc: 'Drag-and-drop fleet ops, route optimization, driver dispatch AI', color: '#00B4FF', url: 'https://movvia-pi.vercel.app' },
  { name: 'ReWired OS', type: 'Business Operating System', industry: 'Enterprise', desc: 'CRM + outreach pipeline + email drip + analytics dashboard', color: '#10b981' },
  { name: 'Four Seasons Bogota', type: 'AI Concierge', industry: 'Luxury Hotel', desc: 'Full-stack AI concierge with Claude SDK, booking automation, guest intel', color: '#d4af37', url: 'https://demo-fourseasons-bogota.vercel.app' },
  { name: 'Osaka Nikkei', type: 'Restaurant Experience', industry: 'Fine Dining', desc: 'Nikkei cuisine showcase with reservation AI, menu intelligence', color: '#ef4444', url: 'https://demo-osaka-nikkei.vercel.app' },
  { name: 'Dharma Beach Club', type: 'Luxury Beach Experience', industry: 'Hospitality', desc: 'VIP booking, Stripe payments, table reservations, event calendar', color: '#d4af37', url: 'https://dharma-topaz.vercel.app' },
  { name: 'Cafe Noir', type: 'Premium Cafe', industry: 'Restaurant', desc: 'Dark luxury cafe branding, online ordering, loyalty system', color: '#92400e', url: 'https://demo-cafenoir.vercel.app' },
  { name: 'La Kasta', type: 'Nightlife & Dining', industry: 'Nightlife', desc: 'VIP table booking, event management, bottle service automation', color: '#a855f7', url: 'https://demo-lakasta.vercel.app' },
  { name: 'Chef Jose', type: 'Personal Chef Brand', industry: 'Culinary', desc: 'Private dining experience site, booking pipeline, menu showcase', color: '#f97316', url: 'https://demo-chefjose.vercel.app' },
  { name: 'Alambique', type: 'Bar & Cocktail Lounge', industry: 'Restaurant', desc: 'Cocktail menu AI, event booking, atmosphere-first design', color: '#b45309', url: 'https://demo-alambique.vercel.app' },
  { name: 'Tutaina', type: 'Latin Gastro Bar', industry: 'Restaurant', desc: 'Music-driven dining experience, reservation system, event pipeline', color: '#dc2626', url: 'https://demo-tutaina.vercel.app' },
  { name: 'Villareal', type: 'Boutique Hospitality', industry: 'Hotel', desc: 'Luxury villa booking, concierge integration, guest experience AI', color: '#059669', url: 'https://demo-villareal.vercel.app' },
  { name: 'Confort', type: 'Hospitality Platform', industry: 'Hotel', desc: 'Comfort-first hotel experience, smart check-in, service automation', color: '#0284c7', url: 'https://demo-confort.vercel.app' },
  { name: 'MDC Boutique', type: 'Boutique Hotel', industry: 'Luxury Hotel', desc: 'Boutique hotel management, guest profiling, automated concierge', color: '#c9a96e' },
  { name: 'BenzDriver', type: 'Luxury Transport', industry: 'Transport', desc: 'Premium chauffeur booking, fleet management, VIP client routing', color: '#1e3a5f', url: 'https://demo-benzdriver.vercel.app' },
  { name: 'Aerotransfer', type: 'Airport Transfers', industry: 'Transport', desc: 'Airport pickup automation, flight tracking, WhatsApp confirmation', color: '#0891b2', url: 'https://demo-aerotransfer.vercel.app' },
  { name: 'Medellin VIP', type: 'Concierge Services', industry: 'Concierge', desc: 'VIP experience curation, booking orchestration, 24/7 AI concierge', color: '#7c3aed', url: 'https://demo-medellinvip.vercel.app' },
  { name: 'World Lion', type: 'Travel & Concierge', industry: 'Travel', desc: 'Global travel coordination, itinerary AI, luxury experience booking', color: '#b45309', url: 'https://demo-worldlion.vercel.app' },
  { name: '100 Luxury', type: 'Luxury Concierge', industry: 'Concierge', desc: 'Ultra-premium concierge platform, wealth-tier service automation', color: '#c9a96e' },
  { name: 'Cartagena Concierge', type: 'City Concierge', industry: 'Concierge', desc: 'Full city concierge system — restaurants, tours, transport, nightlife', color: '#10b981' },
  { name: 'The Vibe with Herflo', type: 'Event Venue', industry: 'Events', desc: 'Venue booking, event management, artist coordination, ticket system', color: '#e11d48', url: 'https://the-vibe-with-herflo.vercel.app' },
  { name: 'BlackSound', type: 'Music & Events', industry: 'Entertainment', desc: 'Artist booking platform, event production, sound design showcase', color: '#18181b', url: 'https://demo-blacksound.vercel.app' },
  { name: 'Next Producciones', type: 'Event Production', industry: 'Production', desc: 'Full production company site, portfolio, booking pipeline', color: '#6366f1', url: 'https://demo-nextproducciones.vercel.app' },
  { name: 'Toque Eventos', type: 'Event Management', industry: 'Events', desc: 'End-to-end event platform — planning, vendor coordination, day-of ops', color: '#f59e0b' },
  { name: 'Angelica Valencia', type: 'Personal Brand', industry: 'Professional', desc: 'Professional portfolio, booking system, content showcase', color: '#ec4899', url: 'https://demo-angelica-valencia.vercel.app' },
  { name: 'Jota Pardo', type: 'Personal Brand', industry: 'Professional', desc: 'Creative portfolio with Cinema Engine, booking integration', color: '#8b5cf6', url: 'https://demo-jota-pardo.vercel.app' },
  { name: 'MariaEu', type: 'Personal Brand', industry: 'Professional', desc: 'Lifestyle brand platform, content management, audience engagement', color: '#f472b6', url: 'https://demo-mariaeu.vercel.app' },
  { name: 'Coach D', type: 'Coaching Platform', industry: 'Professional', desc: 'Session booking, progress tracking, content delivery, payment system', color: '#14b8a6' },
  { name: 'Seven7Times', type: 'Brand & Retail', industry: 'Retail', desc: 'E-commerce foundation, brand storytelling, product showcase', color: '#1e293b', url: 'https://demo-seven7times.vercel.app' },
  { name: 'Rizos', type: 'Salon & Beauty', industry: 'Beauty', desc: 'Appointment booking AI, stylist matching, service menu, loyalty rewards', color: '#d946ef', url: 'https://demo-rizos.vercel.app' },
  { name: 'Ania Consular', type: 'Consular Services', industry: 'Government', desc: 'Document processing, appointment scheduling, status tracking AI', color: '#1d4ed8' },
  { name: 'El Salvador National', type: 'National Platform', industry: 'Government', desc: 'Government-scale digital platform, citizen services, data pipeline', color: '#0369a1' },
  { name: 'Simmer Down Pizza', type: 'Interactive Restaurant', industry: 'Restaurant', desc: 'Canvas-based interactive menu, Easter eggs, gamified ordering', color: '#f97316', url: 'https://simmer-down.vercel.app' },
];

const INDUSTRIES = ['All', ...Array.from(new Set(PROJECTS.map(p => p.industry)))];

export default function Home() {
  const [preloaderVisible, setPreloaderVisible] = useState(true);
  const [preloaderFading, setPreloaderFading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeFilter, setActiveFilter] = useState('All');
  const [visibleProjects, setVisibleProjects] = useState(12);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const framesLoaded = useRef(false);

  const filteredProjects = activeFilter === 'All'
    ? PROJECTS : PROJECTS.filter(p => p.industry === activeFilter);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. LOAD ALL FRAMES — preloader progress is REAL
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let count = 0;
    const imgs: HTMLImageElement[] = [];

    const load = (idx: number) => new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        count++;
        setProgress((count / TOTAL_FRAMES) * 100);
        resolve(img);
      };
      img.src = FRAME_PATH(idx);
    });

    (async () => {
      // Load in batches for speed
      for (let i = 1; i <= TOTAL_FRAMES; i += 20) {
        const batch = [];
        for (let j = i; j < Math.min(i + 20, TOTAL_FRAMES + 1); j++) batch.push(load(j));
        const res = await Promise.all(batch);
        imgs.push(...res);
      }
      framesRef.current = imgs;
      framesLoaded.current = true;

      // Draw first frame immediately
      const c = canvasRef.current;
      if (c) {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
        const ctx = c.getContext('2d', { alpha: false });
        if (ctx && imgs[0]?.naturalWidth) drawCover(ctx, imgs[0], c.width, c.height);
      }

      // Fade out preloader
      setPreloaderFading(true);
      setTimeout(() => setPreloaderVisible(false), 800);
    })();
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SCROLL ENGINE — Lenis + GSAP + Canvas RAF + Three.js Particles
  //    Starts after preloader fades, canvas never re-mounts
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (preloaderVisible) return;

    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lenisInstance: any = null;

    const init = async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      const Lenis = (await import('@studio-freight/lenis')).default;
      const THREE = await import('three');
      gsap.registerPlugin(ScrollTrigger);

      if (destroyed) return;

      // ── LENIS ──
      lenisInstance = new Lenis({
        duration: 1.4,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.5,
      });
      lenisInstance.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time: number) => { lenisInstance?.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);

      // ── CANVAS FRAME RENDERER ──
      const canvas = canvasRef.current;
      const frames = framesRef.current;
      if (!canvas || !frames.length) return;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      resize();
      window.addEventListener('resize', resize, { passive: true });

      let currentFrame = 0;
      let targetFrame = 0;

      ScrollTrigger.create({
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0,
        onUpdate: (self) => {
          targetFrame = self.progress * (TOTAL_FRAMES - 1);
        },
      });

      // ── THREE.JS PARTICLES (floating gold + cyan particles over everything) ──
      const tc = threeCanvasRef.current;
      let threeRenderer: ThreeTypes.WebGLRenderer | null = null;
      let threeScene: ThreeTypes.Scene | null = null;
      let threeCamera: ThreeTypes.PerspectiveCamera | null = null;
      let particles: ThreeTypes.Points | null = null;
      let sphere: ThreeTypes.Mesh | null = null;

      if (tc) {
        threeRenderer = new THREE.WebGLRenderer({ canvas: tc, alpha: true, antialias: true });
        threeRenderer.setSize(window.innerWidth, window.innerHeight);
        threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        threeScene = new THREE.Scene();
        threeCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        threeCamera.position.z = 5;

        // Particles
        const count = 1500;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 20;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
          const t = Math.random();
          colors[i * 3] = 0.788 * (1 - t);
          colors[i * 3 + 1] = 0.663 * (1 - t) + 0.898 * t;
          colors[i * 3 + 2] = 0.431 * (1 - t) + t;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const mat = new THREE.PointsMaterial({
          size: 0.015, vertexColors: true, transparent: true,
          opacity: 0.6, blending: THREE.AdditiveBlending,
        });
        particles = new THREE.Points(geo, mat);
        threeScene.add(particles);

        // Wireframe sphere
        const sphereGeo = new THREE.IcosahedronGeometry(1.8, 1);
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0xc9a96e, wireframe: true, transparent: true, opacity: 0.08,
        });
        sphere = new THREE.Mesh(sphereGeo, wireMat);
        threeScene.add(sphere);

        const onThreeResize = () => {
          if (!threeCamera || !threeRenderer) return;
          threeCamera.aspect = window.innerWidth / window.innerHeight;
          threeCamera.updateProjectionMatrix();
          threeRenderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onThreeResize, { passive: true });
      }

      let mouseX = 0, mouseY = 0;
      const onMouse = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      };
      window.addEventListener('mousemove', onMouse, { passive: true });

      // ── UNIFIED RENDER LOOP (rides GSAP ticker) ──
      gsap.ticker.add(() => {
        // Canvas frame interpolation
        currentFrame += (targetFrame - currentFrame) * 0.12;
        const idx = Math.min(Math.max(Math.round(currentFrame), 0), frames.length - 1);
        const img = frames[idx];
        if (img?.naturalWidth && ctx) {
          drawCover(ctx, img, canvas.width, canvas.height);
        }

        // Three.js particles
        if (particles && sphere && threeRenderer && threeScene && threeCamera) {
          particles.rotation.y += 0.0003;
          particles.rotation.x += 0.0001;
          sphere.rotation.y += 0.0015 + mouseX * 0.005;
          sphere.rotation.x += 0.001 + mouseY * 0.005;
          threeRenderer.render(threeScene, threeCamera);
        }
      });

      // ── NAV GLASSMORPHISM (on ticker) ──
      let navBg = 0;
      const nav = document.querySelector('.nav') as HTMLElement;
      gsap.ticker.add(() => {
        if (!nav) return;
        const t = window.scrollY > 60 ? 0.92 : 0;
        navBg += (t - navBg) * 0.08;
        nav.style.background = `rgba(6,6,10,${navBg.toFixed(3)})`;
        nav.style.backdropFilter = navBg > 0.01 ? `blur(${(navBg * 20).toFixed(1)}px)` : 'none';
      });

      // ── SCROLL PROGRESS BAR (on ticker) ──
      let pw = 0;
      const bar = document.querySelector('.scroll-progress') as HTMLElement;
      if (bar) {
        gsap.ticker.add(() => {
          const t = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          pw += (t - pw) * 0.1;
          bar.style.transform = `scaleX(${pw.toFixed(5)})`;
        });
      }

      // ── HERO ENTRANCE ──
      const tl = gsap.timeline({ delay: 0.2 });
      tl.from('.hero-eyebrow', { y: 30, opacity: 0, duration: 1, ease: 'power4.out' })
        .from('.hero-title-line', { y: 120, opacity: 0, duration: 1.4, stagger: 0.2, ease: 'power4.out' }, '-=0.6')
        .from('.hero-subtitle', { y: 40, opacity: 0, duration: 1, ease: 'power3.out' }, '-=0.7')
        .from('.hero-cta-wrap', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.5')
        .from('.hero-scroll-indicator', { opacity: 0, duration: 1.2 }, '-=0.3');

      // ── HERO PARALLAX (text moves up as you scroll, ship stays) ──
      gsap.to('.hero-content', {
        y: -150, opacity: 0,
        scrollTrigger: { trigger: '.hero', start: 'top top', end: '60% top', scrub: 1.5 },
      });
      gsap.to('.hero-scroll-indicator', {
        opacity: 0,
        scrollTrigger: { trigger: '.hero', start: '20% top', end: '40% top', scrub: true },
      });

      // ── REVEAL ANIMATIONS ──
      gsap.utils.toArray<HTMLElement>('.reveal-up').forEach((el) => {
        gsap.from(el, {
          y: 80, opacity: 0, duration: 1.2, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' },
        });
      });

      gsap.utils.toArray<HTMLElement>('.stagger-children').forEach((container) => {
        gsap.from(container.children, {
          y: 60, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: container, start: 'top 85%', toggleActions: 'play none none none' },
        });
      });

      // ── COUNTERS ──
      gsap.utils.toArray<HTMLElement>('.counter').forEach((el) => {
        const target = parseInt(el.dataset.target || '0');
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target, duration: 2.5, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' },
          onUpdate: () => { el.textContent = Math.round(obj.val) + (el.dataset.suffix || ''); },
        });
      });

      // ── DIVIDERS ──
      gsap.utils.toArray<HTMLElement>('.section-divider').forEach((el) => {
        gsap.fromTo(el, { scaleX: 0 }, {
          scaleX: 1, duration: 1.5, ease: 'power3.inOut',
          scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' },
        });
      });

      // ── SCALE-IN ──
      gsap.utils.toArray<HTMLElement>('.scale-in').forEach((el) => {
        gsap.from(el, {
          scale: 0.92, opacity: 0, duration: 1, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' },
        });
      });
    };

    init();
    return () => { destroyed = true; lenisInstance?.destroy(); };
  }, [preloaderVisible]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CUSTOM CURSOR
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (preloaderVisible) return;
    const cursor = cursorRef.current;
    const dot = cursorDotRef.current;
    if (!cursor || !dot) return;

    let mx = 0, my = 0, cx = 0, cy = 0, dx2 = 0, dy2 = 0, raf: number;

    const move = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    const tick = () => {
      cx += (mx - cx) * 0.08; cy += (my - cy) * 0.08;
      cursor.style.transform = `translate3d(${cx - 18}px,${cy - 18}px,0)`;
      dx2 += (mx - dx2) * 0.25; dy2 += (my - dy2) * 0.25;
      dot.style.transform = `translate3d(${dx2 - 2.5}px,${dy2 - 2.5}px,0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', move, { passive: true });
    raf = requestAnimationFrame(tick);

    const els = document.querySelectorAll('.magnetic');
    const ent = () => cursor.classList.add('cursor-hover');
    const lv = () => cursor.classList.remove('cursor-hover');
    els.forEach(e => { e.addEventListener('mouseenter', ent); e.addEventListener('mouseleave', lv); });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', move);
      els.forEach(e => { e.removeEventListener('mouseenter', ent); e.removeEventListener('mouseleave', lv); });
    };
  }, [preloaderVisible]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — Canvas is ALWAYS mounted. Preloader overlays on top.
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ═══ PERSISTENT BACKGROUND LAYERS (never unmount) ═══ */}
      <canvas ref={canvasRef} className="bg-canvas" />
      <div className="bg-overlay" />
      <canvas ref={threeCanvasRef} className="three-canvas" />

      {/* Film Grain + Vignette */}
      <svg className="film-grain" aria-hidden="true">
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <div className="vignette" />

      {/* ═══ PRELOADER (overlays on top, fades out) ═══ */}
      {preloaderVisible && (
        <div className={`preloader ${preloaderFading ? 'preloader-fade' : ''}`}>
          <div className="preloader-content">
            <div className="preloader-logo">
              <span className="pl-gold">Machine</span><span className="pl-white">Mind</span>
            </div>
            <div className="pl-bar-wrap">
              <div className="pl-bar" style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
            <div className="pl-meta">
              <span className="pl-pct">{Math.round(progress)}%</span>
              <span className="pl-status">LOADING {Math.round(progress) < 100 ? 'FRAMES' : 'COMPLETE'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CURSOR ═══ */}
      <div ref={cursorRef} className="cursor" />
      <div ref={cursorDotRef} className="cursor-dot" />

      {/* ═══ SCROLL PROGRESS ═══ */}
      <div className="scroll-progress" />

      {/* ═══ NAVIGATION ═══ */}
      <nav className="nav">
        <a href="/" className="nav-logo magnetic">
          <span className="nav-logo-gold">MACHINE</span><span>MIND</span>
        </a>
        <div className="nav-links">
          {['Systems', 'Portfolio', 'Process', 'About', 'Contact'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} className="nav-link magnetic">{item}</a>
          ))}
        </div>
        <button className="nav-hamburger magnetic" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
          <span className={`hb-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hb-line ${mobileMenuOpen ? 'open' : ''}`} />
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          {['Systems', 'Portfolio', 'Process', 'About', 'Contact'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} className="mm-link" onClick={() => setMobileMenuOpen(false)}>{item}</a>
          ))}
        </div>
      )}

      {/* ═══ HERO ═══ */}
      <section className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">AI AUTOMATION CONSULTANCY</p>
          <h1 className="hero-title">
            <span className="hero-title-line">We Engineer</span>
            <span className="hero-title-line">Autonomous <em>Intelligence</em></span>
          </h1>
          <p className="hero-subtitle">
            111+ systems deployed. AI that sells, books, qualifies, and operates 24/7.
            <br />We don&apos;t build tools. We build unfair advantages.
          </p>
          <div className="hero-cta-wrap">
            <a href="#contact" className="btn-primary magnetic">
              <span>Start a Project</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
            <a href="#portfolio" className="btn-ghost magnetic">View Portfolio</a>
          </div>
        </div>
        <div className="hero-scroll-indicator">
          <div className="scroll-line" /><span>Scroll to explore</span>
        </div>
      </section>

      {/* ═══ METRICS ═══ */}
      <section className="metrics">
        <div className="metrics-grid stagger-children">
          {[
            { value: '111', suffix: '+', label: 'Systems Built' },
            { value: '35', suffix: '+', label: 'Industries Served' },
            { value: '24', suffix: '/7', label: 'AI Active' },
            { value: '6', suffix: '', label: 'Weeks Avg Delivery' },
          ].map((s, i) => (
            <div key={i} className="metric">
              <span className="metric-value counter" data-target={s.value} data-suffix={s.suffix}>0</span>
              <span className="metric-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SYSTEMS ═══ */}
      <section id="systems" className="section-dark">
        <div className="section-inner">
          <div className="section-header reveal-up">
            <p className="eyebrow">WHAT WE BUILD</p>
            <h2>Three Engines. <em>Infinite Leverage.</em></h2>
            <p className="section-desc">Each system compounds. Together they create an autonomous revenue machine.</p>
          </div>
          <div className="systems-grid stagger-children">
            {[
              { num: '01', title: 'Sofia AI', icon: '////', desc: 'WhatsApp AI that qualifies leads, handles bookings, detects psychology, and closes deals 24/7. Six mental models. Escalation intelligence.', features: ['WhatsApp API', 'Psych Sales', 'Lead Scoring', 'Auto-Escalation', 'CRM Sync', 'Multi-Language'], metric: '24/7 Revenue Generation' },
              { num: '02', title: 'Cinema Engine', icon: '[][]', desc: 'Websites that feel like films. 25 layers of scroll-driven animation, Three.js environments, GSAP choreography. Every pixel converts.', features: ['GSAP ScrollTrigger', 'Three.js', 'Scroll Video', 'Physics', 'Perf A+', 'Mobile-First'], metric: '25-Layer Cinematic System' },
              { num: '03', title: 'Viceroy', icon: '><><', desc: 'AI-powered investor qualification. Detects intent, scores across 8 dimensions, routes to humans when stakes are high.', features: ['Psychology AI', '8-Axis Score', 'Email Drip', 'Smart Route', 'Deal Intel', 'Pipeline'], metric: 'Autonomous Deal Flow' },
            ].map(sys => (
              <div key={sys.num} className="system-card scale-in">
                <div className="sys-head"><span className="sys-num">{sys.num}</span><span className="sys-icon">{sys.icon}</span></div>
                <h3 className="sys-title">{sys.title}</h3>
                <p className="sys-metric">{sys.metric}</p>
                <p className="sys-desc">{sys.desc}</p>
                <ul className="sys-features">{sys.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ═══ PORTFOLIO ═══ */}
      <section id="portfolio" className="section-dark">
        <div className="section-inner">
          <div className="section-header reveal-up">
            <p className="eyebrow">PORTFOLIO</p>
            <h2>{PROJECTS.length} Systems. <em>Zero Templates.</em></h2>
            <p className="section-desc">Every build is custom-engineered. Every deployment is production-grade.</p>
          </div>
          <div className="filter-bar reveal-up">
            {INDUSTRIES.slice(0, 12).map(ind => (
              <button key={ind} className={`filter-btn magnetic ${activeFilter === ind ? 'active' : ''}`}
                onClick={() => { setActiveFilter(ind); setVisibleProjects(12); }}>{ind}</button>
            ))}
          </div>
          <div className="portfolio-grid stagger-children">
            {filteredProjects.slice(0, visibleProjects).map((p, i) => {
              const inner = (
                <div className="card-inner">
                  <div className="card-top">
                    <span className="card-ind">{p.industry}</span>
                    {p.tag && <span className="card-tag">{p.tag}</span>}
                  </div>
                  <div className="card-bot">
                    <span className="card-type">{p.type}</span>
                    <h3 className="card-name">{p.name}</h3>
                    <p className="card-desc">{p.desc}</p>
                    <span className={`card-link ${!p.url ? 'card-link-priv' : ''}`}>
                      {p.url ? <>View Live <span className="arr" /></> : 'Enterprise'}
                    </span>
                  </div>
                </div>
              );
              return p.url ? (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="portfolio-card magnetic" style={{ '--ac': p.color } as React.CSSProperties}>{inner}</a>
              ) : (
                <div key={i} className="portfolio-card" style={{ '--ac': p.color } as React.CSSProperties}>{inner}</div>
              );
            })}
          </div>
          {visibleProjects < filteredProjects.length && (
            <div className="load-more reveal-up">
              <button className="btn-ghost magnetic" onClick={() => setVisibleProjects(v => v + 12)}>
                Show More ({filteredProjects.length - visibleProjects} remaining)
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="section-divider" />

      {/* ═══ PROCESS ═══ */}
      <section id="process" className="section-dark">
        <div className="section-inner">
          <div className="section-header reveal-up">
            <p className="eyebrow">THE PROCESS</p>
            <h2>Four Phases. <em>Zero Waste.</em></h2>
          </div>
          <div className="process-grid stagger-children">
            {[
              { n: '01', t: 'Discovery', d: 'We decode your revenue leaks, map automation opportunities, and identify the AI that will generate the highest ROI.' },
              { n: '02', t: 'Architecture', d: 'Custom system design — database schemas, AI pipelines, integration maps. Every component is purpose-built.' },
              { n: '03', t: 'Build', d: 'Rapid deployment with Cinema Engine aesthetics. TypeScript strict, Supabase RLS, Vercel edge. Production-grade from day one.' },
              { n: '04', t: 'Scale', d: 'Continuous optimization. Your AI learns your business, your systems compound, your competitors wonder what happened.' },
            ].map(p => (
              <div key={p.n} className="process-card scale-in">
                <span className="proc-num">{p.n}</span>
                <h3 className="proc-title">{p.t}</h3>
                <p className="proc-desc">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MANIFESTO (transparent — ship fully visible) ═══ */}
      <section className="manifesto">
        <div className="manifesto-content reveal-up">
          <p>We don&apos;t build websites.<br />We build systems that <em>breathe</em>,<br />that <em>learn</em>, that <em>compound</em>.<br />Every deployment is a moat.<br />Every pixel is choreographed.<br /><strong>We create what doesn&apos;t exist yet.</strong></p>
        </div>
      </section>

      {/* ═══ ABOUT ═══ */}
      <section id="about" className="section-dark">
        <div className="section-inner about-grid">
          <div className="about-left reveal-up">
            <p className="eyebrow">ABOUT</p>
            <h2>Built in <em>Cartagena</em>.<br />Deployed <em>Everywhere</em>.</h2>
          </div>
          <div className="about-right reveal-up">
            <p>MachineMind is an AI automation consultancy that builds autonomous intelligence infrastructure for businesses that refuse to operate manually.</p>
            <p>We specialize in hospitality, real estate, private capital, and high-touch service industries where every missed message is lost revenue.</p>
            <div className="stack-tags">
              {['Next.js 16', 'TypeScript', 'Supabase', 'Claude AI', 'Twilio', 'Vercel', 'GSAP', 'Three.js'].map(t => (
                <span key={t} className="stack-tag">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <section id="contact" className="section-dark contact-section">
        <div className="section-inner contact-inner reveal-up">
          <p className="eyebrow">LET&apos;S BUILD</p>
          <h2>Ready to build something<br />that doesn&apos;t exist yet?</h2>
          <p className="contact-sub">We take on 3 new clients per quarter. Currently accepting projects for Q3 2026.</p>
          <a href="https://cal.com/machinemind" className="btn-primary magnetic" target="_blank" rel="noopener noreferrer">
            <span>Book a Discovery Call</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </a>
          <p className="contact-email">or email <a href="mailto:machinemindconsulting@gmail.com">machinemindconsulting@gmail.com</a></p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div><span className="footer-logo"><span className="fl-gold">MACHINE</span>MIND</span><p className="footer-tag">Autonomous Intelligence Infrastructure</p></div>
          <div className="footer-links">{['Systems','Portfolio','Process','About','Contact'].map(l => <a key={l} href={`#${l.toLowerCase()}`}>{l}</a>)}</div>
          <p className="footer-copy">&copy; 2026 MachineMind Consulting &middot; Cartagena, Colombia</p>
        </div>
      </footer>

      <style>{STYLES}</style>
    </>
  );
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cw: number, ch: number) {
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
}

// ═══════════════════════════════════════════════════════════════════════════
// ALL STYLES
// ═══════════════════════════════════════════════════════════════════════════
const STYLES = `
@import url('https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#06060a;--fg:#f0f0f3;--gold:#c9a96e;--cyan:#00e5ff;
  --dim:rgba(240,240,243,0.35);--glass:rgba(255,255,255,0.04);
  --gb:rgba(255,255,255,0.08);
  --fd:'Clash Display',sans-serif;--fb:'Satoshi',sans-serif;
  --fs:'Instrument Serif',serif;--fm:'JetBrains Mono',monospace;
}
html{background:var(--bg);color:var(--fg)}
body{font-family:var(--fb);overflow-x:hidden;-webkit-font-smoothing:antialiased;cursor:none}
::selection{background:var(--gold);color:var(--bg)}

/* ═══ BACKGROUND LAYERS ═══ */
.bg-canvas{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;will-change:contents}
.bg-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;
  background:radial-gradient(ellipse at 50% 40%,rgba(6,6,10,0.25) 0%,rgba(6,6,10,0.55) 100%);
  pointer-events:none}
.three-canvas{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2;pointer-events:none}

/* ═══ OVERLAYS ═══ */
.film-grain{position:fixed;inset:0;pointer-events:none;opacity:0.025;z-index:9998}
.vignette{position:fixed;inset:0;pointer-events:none;box-shadow:inset 0 0 250px rgba(0,0,0,0.5);z-index:9997}

/* ═══ PRELOADER ═══ */
.preloader{position:fixed;inset:0;z-index:99999;background:#06060a;display:flex;align-items:center;justify-content:center;transition:opacity .6s ease,visibility .6s}
.preloader-fade{opacity:0;visibility:hidden}
.preloader-content{text-align:center;position:relative;z-index:2}
.preloader-logo{font-family:var(--fd);font-size:clamp(36px,7vw,64px);font-weight:600;margin-bottom:56px;letter-spacing:-0.03em}
.pl-gold{color:var(--gold)}.pl-white{color:var(--fg)}
.pl-bar-wrap{width:240px;height:1px;background:rgba(201,169,110,0.15);margin:0 auto 28px;overflow:hidden}
.pl-bar{height:100%;width:100%;background:linear-gradient(90deg,var(--gold),var(--cyan));transform-origin:left;transition:transform .15s ease-out}
.pl-meta{display:flex;flex-direction:column;gap:8px}
.pl-pct{font-family:var(--fm);font-size:11px;color:var(--gold);letter-spacing:.25em}
.pl-status{font-family:var(--fb);font-size:9px;color:rgba(240,240,243,0.25);letter-spacing:.5em;text-transform:uppercase}

/* ═══ CURSOR ═══ */
.cursor{position:fixed;top:0;left:0;width:36px;height:36px;border:1px solid var(--gold);border-radius:50%;pointer-events:none;z-index:99999;will-change:transform;transition:width .4s cubic-bezier(.23,1,.32,1),height .4s cubic-bezier(.23,1,.32,1),border-color .4s;mix-blend-mode:difference}
.cursor-dot{position:fixed;top:0;left:0;width:5px;height:5px;background:var(--gold);border-radius:50%;pointer-events:none;z-index:99999;will-change:transform}
.cursor.cursor-hover{width:56px;height:56px;border-color:var(--cyan)}
@media(max-width:768px){.cursor,.cursor-dot{display:none}body{cursor:auto}}

/* ═══ SCROLL PROGRESS ═══ */
.scroll-progress{position:fixed;top:0;left:0;height:2px;width:100%;background:linear-gradient(90deg,var(--gold),var(--cyan));z-index:9999;transform:scaleX(0);transform-origin:left;will-change:transform}

/* ═══ NAV ═══ */
.nav{position:fixed;top:0;left:0;right:0;z-index:1000;padding:20px clamp(24px,5vw,80px);display:flex;justify-content:space-between;align-items:center}
.nav-logo{font-family:var(--fb);font-size:11px;font-weight:700;letter-spacing:.3em;color:var(--fg);text-decoration:none}
.nav-logo-gold{color:var(--gold)}
.nav-links{display:flex;gap:36px}
.nav-link{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--fg);text-decoration:none;opacity:.4;transition:opacity .3s}
.nav-link:hover{opacity:1}
.nav-hamburger{display:none;background:none;border:none;cursor:none;width:28px;height:20px;position:relative;z-index:1001}
.hb-line{display:block;width:100%;height:1px;background:var(--fg);position:absolute;left:0;transition:all .3s}
.hb-line:first-child{top:4px}.hb-line:last-child{bottom:4px}
.hb-line.open:first-child{top:50%;transform:rotate(45deg)}.hb-line.open:last-child{bottom:50%;transform:rotate(-45deg)}
@media(max-width:768px){.nav-links{display:none}.nav-hamburger{display:block}}
.mobile-menu{position:fixed;inset:0;background:rgba(6,6,10,0.97);z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px}
.mm-link{font-family:var(--fd);font-size:32px;font-weight:500;color:var(--fg);text-decoration:none;opacity:.6;transition:opacity .3s,color .3s}
.mm-link:hover{opacity:1;color:var(--gold)}

/* ═══ ALL CONTENT ═══ */
.hero,.metrics,.section-dark,.manifesto,.site-footer,.section-divider,.mobile-menu{position:relative;z-index:5}

/* ═══ HERO ═══ */
.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 clamp(24px,5vw,80px)}
.hero-content{max-width:1000px}
.hero-eyebrow{font-size:10px;letter-spacing:.6em;text-transform:uppercase;color:var(--gold);margin-bottom:28px}
.hero-title{font-family:var(--fd);font-size:clamp(44px,8vw,110px);font-weight:500;line-height:1.02;letter-spacing:-.04em;margin-bottom:36px;text-shadow:0 4px 60px rgba(0,0,0,0.6)}
.hero-title-line{display:block}
.hero-title em{font-family:var(--fs);font-style:italic;color:var(--gold)}
.hero-subtitle{font-size:clamp(15px,1.8vw,19px);color:var(--dim);line-height:1.8;max-width:580px;margin-bottom:48px;text-shadow:0 2px 30px rgba(0,0,0,0.5)}
.hero-cta-wrap{display:flex;gap:16px;flex-wrap:wrap}
.hero-scroll-indicator{position:absolute;bottom:40px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:12px}
.scroll-line{width:1px;height:56px;background:linear-gradient(to bottom,var(--gold),transparent);animation:sp 2s ease-in-out infinite}
.hero-scroll-indicator span{font-size:8px;letter-spacing:.4em;text-transform:uppercase;color:var(--dim)}
@keyframes sp{0%,100%{opacity:.3;transform:scaleY(.7)}50%{opacity:1;transform:scaleY(1)}}

/* ═══ BUTTONS ═══ */
.btn-primary{display:inline-flex;align-items:center;gap:12px;padding:18px 36px;background:var(--gold);color:var(--bg);font-family:var(--fb);font-size:11px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;transition:all .4s cubic-bezier(.4,0,.2,1)}
.btn-primary:hover{background:var(--fg);transform:translateY(-2px)}
.btn-ghost{display:inline-flex;align-items:center;padding:18px 36px;border:1px solid rgba(255,255,255,0.15);color:var(--fg);font-family:var(--fb);font-size:11px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;background:none;cursor:none;transition:all .4s}
.btn-ghost:hover{border-color:var(--gold);color:var(--gold)}

/* ═══ SHARED ═══ */
.eyebrow{font-size:10px;letter-spacing:.5em;text-transform:uppercase;color:var(--gold);margin-bottom:16px}
.section-header{margin-bottom:56px}
.section-header h2{font-family:var(--fd);font-size:clamp(32px,5vw,60px);font-weight:500;letter-spacing:-.03em;line-height:1.1}
.section-header h2 em{font-family:var(--fs);font-style:italic;color:var(--gold)}
.section-desc{font-size:16px;color:var(--dim);line-height:1.7;max-width:560px;margin-top:16px}
.section-dark{background:rgba(6,6,10,0.88);backdrop-filter:blur(2px)}
.section-inner{padding:clamp(100px,15vh,180px) clamp(24px,5vw,80px)}
.section-divider{height:1px;margin:0 clamp(24px,5vw,80px);background:linear-gradient(90deg,transparent,var(--gold),transparent);transform-origin:center;opacity:.3;position:relative;z-index:5}

/* ═══ METRICS ═══ */
.metrics{padding:0 clamp(24px,5vw,80px);border-top:1px solid var(--gb);border-bottom:1px solid var(--gb);background:rgba(6,6,10,0.9)}
.metrics-grid{display:grid;grid-template-columns:repeat(4,1fr)}
@media(max-width:768px){.metrics-grid{grid-template-columns:repeat(2,1fr)}}
.metric{padding:44px 24px;text-align:center;border-right:1px solid var(--gb)}
.metric:last-child{border-right:none}
.metric-value{font-family:var(--fd);font-size:clamp(36px,5vw,56px);font-weight:600;display:block}
.metric-label{font-size:9px;letter-spacing:.4em;text-transform:uppercase;color:var(--dim);margin-top:8px;display:block}

/* ═══ SYSTEMS ═══ */
.systems-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:2px}
.system-card{background:var(--glass);border:1px solid var(--gb);padding:48px 40px;position:relative;transition:border-color .4s,background .4s;backdrop-filter:blur(8px)}
.system-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--gold);transform:scaleX(0);transform-origin:left;transition:transform .6s cubic-bezier(.4,0,.2,1)}
.system-card:hover::before{transform:scaleX(1)}
.system-card:hover{border-color:rgba(201,169,110,0.3);background:rgba(255,255,255,0.06)}
.sys-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.sys-num{font-family:var(--fm);font-size:11px;color:var(--gold);letter-spacing:.2em}
.sys-icon{font-family:var(--fm);font-size:11px;color:var(--dim)}
.sys-title{font-family:var(--fd);font-size:28px;font-weight:500;margin-bottom:8px}
.sys-metric{font-size:11px;color:var(--gold);letter-spacing:.15em;text-transform:uppercase;margin-bottom:20px}
.sys-desc{font-size:15px;color:var(--dim);line-height:1.7;margin-bottom:28px}
.sys-features{list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.sys-features li{font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:7px 11px;background:rgba(201,169,110,0.08);color:var(--gold)}

/* ═══ PORTFOLIO ═══ */
.filter-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:48px}
.filter-btn{font-family:var(--fb);font-size:10px;letter-spacing:.15em;text-transform:uppercase;padding:10px 18px;background:none;border:1px solid var(--gb);color:var(--dim);cursor:none;transition:all .3s}
.filter-btn:hover,.filter-btn.active{border-color:var(--gold);color:var(--gold)}
.filter-btn.active{background:rgba(201,169,110,0.1)}
.portfolio-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}
@media(max-width:1024px){.portfolio-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.portfolio-grid{grid-template-columns:1fr}}
.portfolio-card{aspect-ratio:16/10;background:var(--glass);border:1px solid var(--gb);position:relative;overflow:hidden;transition:all .5s cubic-bezier(.4,0,.2,1);text-decoration:none;display:block;backdrop-filter:blur(4px)}
.portfolio-card::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at top left,var(--ac,var(--gold)) 0%,transparent 70%);opacity:0;transition:opacity .5s}
.portfolio-card:hover::before{opacity:.15}
.portfolio-card:hover{border-color:var(--ac,var(--gold));transform:translateY(-4px)}
.card-inner{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:28px}
.card-top{display:flex;justify-content:space-between;align-items:flex-start}
.card-ind{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
.card-tag{font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:var(--bg);background:var(--gold);padding:4px 8px}
.card-bot{margin-top:auto}
.card-type{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--ac,var(--gold))}
.card-name{font-family:var(--fd);font-size:clamp(20px,2vw,26px);font-weight:500;margin:6px 0;color:var(--fg)}
.card-desc{font-size:13px;color:var(--dim);line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-link{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--ac,var(--gold));margin-top:12px;display:inline-block;opacity:0;transform:translateY(8px);transition:all .3s}
.portfolio-card:hover .card-link{opacity:1;transform:translateY(0)}
.card-link-priv{color:var(--dim)}
.arr{display:inline-block;width:12px;height:1px;background:var(--ac,var(--gold));position:relative;vertical-align:middle;margin-left:8px}
.arr::after{content:'';position:absolute;right:0;top:-3px;width:6px;height:6px;border-right:1px solid var(--ac,var(--gold));border-top:1px solid var(--ac,var(--gold));transform:rotate(45deg)}
.load-more{text-align:center;margin-top:48px}

/* ═══ PROCESS ═══ */
.process-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px}
@media(max-width:1024px){.process-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.process-grid{grid-template-columns:1fr}}
.process-card{background:var(--glass);border:1px solid var(--gb);padding:48px 36px;position:relative;transition:border-color .4s,background .4s;backdrop-filter:blur(8px)}
.process-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--gold);transform:scaleX(0);transform-origin:left;transition:transform .6s cubic-bezier(.4,0,.2,1)}
.process-card:hover::before{transform:scaleX(1)}
.process-card:hover{border-color:rgba(201,169,110,0.2);background:rgba(255,255,255,0.04)}
.proc-num{font-family:var(--fm);font-size:11px;color:var(--gold);letter-spacing:.3em;display:block;margin-bottom:24px}
.proc-title{font-family:var(--fd);font-size:24px;font-weight:500;margin-bottom:16px}
.proc-desc{font-size:14px;color:var(--dim);line-height:1.7}

/* ═══ MANIFESTO ═══ */
.manifesto{padding:clamp(120px,18vh,240px) clamp(24px,5vw,80px);display:flex;justify-content:center}
.manifesto-content{max-width:800px;text-align:center}
.manifesto-content p{font-family:var(--fd);font-size:clamp(26px,4vw,48px);font-weight:400;line-height:1.4;letter-spacing:-.02em;text-shadow:0 4px 40px rgba(0,0,0,0.7)}
.manifesto-content em{font-family:var(--fs);font-style:italic;color:var(--gold)}
.manifesto-content strong{display:block;margin-top:28px;color:var(--gold)}

/* ═══ ABOUT ═══ */
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:start}
@media(max-width:768px){.about-grid{grid-template-columns:1fr;gap:40px}}
.about-left h2{font-family:var(--fd);font-size:clamp(32px,4vw,52px);font-weight:500;letter-spacing:-.03em;line-height:1.15}
.about-left h2 em{font-family:var(--fs);font-style:italic;color:var(--gold)}
.about-right p{font-size:15px;color:var(--dim);line-height:1.8;margin-bottom:20px}
.stack-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:28px}
.stack-tag{font-size:9px;letter-spacing:.15em;text-transform:uppercase;padding:8px 14px;border:1px solid var(--gb);color:var(--dim);transition:all .3s}
.stack-tag:hover{border-color:var(--gold);color:var(--gold)}

/* ═══ CONTACT ═══ */
.contact-section{text-align:center}
.contact-inner{max-width:700px;margin:0 auto;display:flex;flex-direction:column;align-items:center}
.contact-inner h2{font-family:var(--fd);font-size:clamp(34px,5vw,60px);font-weight:500;letter-spacing:-.03em;line-height:1.1;margin-bottom:24px}
.contact-sub{font-size:16px;color:var(--dim);margin-bottom:48px}
.contact-email{font-size:14px;color:var(--dim);margin-top:28px}
.contact-email a{color:var(--gold);text-decoration:none}
.contact-email a:hover{text-decoration:underline}

/* ═══ FOOTER ═══ */
.site-footer{padding:72px clamp(24px,5vw,80px) 40px;border-top:1px solid var(--gb);background:rgba(6,6,10,0.95)}
.footer-inner{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:24px}
.footer-logo{font-family:var(--fb);font-size:11px;font-weight:700;letter-spacing:.3em}
.fl-gold{color:var(--gold)}
.footer-tag{font-size:10px;color:var(--dim);margin-top:4px}
.footer-links{display:flex;gap:28px}
.footer-links a{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--dim);text-decoration:none;transition:color .3s}
.footer-links a:hover{color:var(--gold)}
.footer-copy{font-size:11px;color:rgba(240,240,243,0.15)}
@media(max-width:768px){.footer-inner{flex-direction:column;text-align:center}.footer-links{justify-content:center;flex-wrap:wrap}}
`;

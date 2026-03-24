'use client';

import { useEffect, useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// MACHINEMIND CINEMA ENGINE — APEX BUILD
// $50M Budget Aesthetic | 25-Layer Cinematic System
// ═══════════════════════════════════════════════════════════════════════════

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // PRELOADER + INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Simulate loading with progress
    let prog = 0;
    const interval = setInterval(() => {
      prog += Math.random() * 15;
      if (prog >= 100) {
        prog = 100;
        clearInterval(interval);
        setTimeout(() => setLoaded(true), 400);
      }
      setProgress(prog);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // CINEMA ENGINE INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!loaded) return;

    const initCinema = async () => {
      // Dynamic imports for performance
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      const { ScrollSmoother } = await import('gsap/ScrollSmoother');

      gsap.registerPlugin(ScrollTrigger);

      // Try to register ScrollSmoother if available
      try {
        gsap.registerPlugin(ScrollSmoother);
        ScrollSmoother.create({
          smooth: 1.5,
          effects: true,
          smoothTouch: 0.1,
        });
      } catch (e) {
        // ScrollSmoother requires GSAP premium, fallback to native smooth scroll
        document.documentElement.style.scrollBehavior = 'smooth';
      }

      // ═══════════════════════════════════════════════════════════════════════
      // HERO ANIMATIONS
      // ═══════════════════════════════════════════════════════════════════════
      const heroTl = gsap.timeline({ delay: 0.2 });

      heroTl
        .from('.hero-eyebrow', {
          y: 30,
          opacity: 0,
          duration: 1,
          ease: 'power4.out'
        })
        .from('.hero-title-line', {
          y: 100,
          opacity: 0,
          duration: 1.2,
          stagger: 0.15,
          ease: 'power4.out'
        }, '-=0.6')
        .from('.hero-subtitle', {
          y: 30,
          opacity: 0,
          duration: 1,
          ease: 'power3.out'
        }, '-=0.6')
        .from('.hero-cta', {
          y: 30,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out'
        }, '-=0.4')
        .from('.hero-scroll', {
          opacity: 0,
          duration: 1,
          ease: 'power2.out'
        }, '-=0.2');

      // ═══════════════════════════════════════════════════════════════════════
      // SCROLL-TRIGGERED ANIMATIONS
      // ═══════════════════════════════════════════════════════════════════════

      // Fade up animations
      gsap.utils.toArray<HTMLElement>('.reveal-up').forEach((el) => {
        gsap.from(el, {
          y: 80,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });
      });

      // Stagger children animations
      gsap.utils.toArray<HTMLElement>('.stagger-children').forEach((container) => {
        gsap.from(container.children, {
          y: 60,
          opacity: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: container,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        });
      });

      // Parallax effects
      gsap.utils.toArray<HTMLElement>('.parallax').forEach((el) => {
        const speed = parseFloat(el.dataset.speed || '0.5');
        gsap.to(el, {
          y: () => -ScrollTrigger.maxScroll(window) * speed,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      });

      // Text reveal animations
      gsap.utils.toArray<HTMLElement>('.text-reveal').forEach((el) => {
        gsap.from(el, {
          backgroundSize: '0% 100%',
          duration: 1.5,
          ease: 'power3.inOut',
          scrollTrigger: {
            trigger: el,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        });
      });

      // Counter animations
      gsap.utils.toArray<HTMLElement>('.counter').forEach((el) => {
        const target = parseInt(el.dataset.target || '0');
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
          onUpdate: () => {
            el.textContent = Math.round(obj.val) + (el.dataset.suffix || '');
          },
        });
      });

      // Horizontal scroll section
      const horizontalSection = document.querySelector('.horizontal-scroll');
      if (horizontalSection) {
        const panels = gsap.utils.toArray<HTMLElement>('.horizontal-panel');
        gsap.to(panels, {
          xPercent: -100 * (panels.length - 1),
          ease: 'none',
          scrollTrigger: {
            trigger: horizontalSection,
            pin: true,
            scrub: 1,
            end: () => '+=' + (horizontalSection as HTMLElement).offsetWidth,
          },
        });
      }

      // Scale on scroll
      gsap.utils.toArray<HTMLElement>('.scale-on-scroll').forEach((el) => {
        gsap.from(el, {
          scale: 0.8,
          opacity: 0,
          duration: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });
      });

      // Line draw animations
      gsap.utils.toArray<SVGPathElement>('.draw-line').forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
        gsap.to(path, {
          strokeDashoffset: 0,
          duration: 2,
          ease: 'power2.inOut',
          scrollTrigger: {
            trigger: path,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        });
      });
    };

    initCinema();
  }, [loaded]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOM CURSOR
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!loaded) return;

    const cursor = cursorRef.current;
    const cursorDot = cursorDotRef.current;
    if (!cursor || !cursorDot) return;

    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.left = mouseX + 'px';
      cursorDot.style.top = mouseY + 'px';
    };

    const animate = () => {
      cursorX += (mouseX - cursorX) * 0.1;
      cursorY += (mouseY - cursorY) * 0.1;
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';
      requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', onMouseMove);
    animate();

    // Magnetic effect on buttons/links
    const magnetics = document.querySelectorAll('.magnetic');
    magnetics.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('cursor-hover');
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('cursor-hover');
      });
    });

    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [loaded]);

  // ═══════════════════════════════════════════════════════════════════════════
  // THREE.JS PARTICLE SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!loaded || !canvasRef.current) return;

    const initThree = async () => {
      const THREE = await import('three');

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current!,
        alpha: true,
        antialias: true
      });

      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Particles
      const particleCount = 2000;
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

        // Gold to cyan gradient
        const t = Math.random();
        colors[i * 3] = 0.788 * (1 - t) + 0 * t;     // R
        colors[i * 3 + 1] = 0.663 * (1 - t) + 0.898 * t; // G
        colors[i * 3 + 2] = 0.431 * (1 - t) + 1 * t;   // B
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.02,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // Wireframe sphere
      const sphereGeometry = new THREE.IcosahedronGeometry(2, 1);
      const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0xc9a96e,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      });
      const sphere = new THREE.Mesh(sphereGeometry, wireframeMaterial);
      scene.add(sphere);

      camera.position.z = 5;

      let mouseX = 0, mouseY = 0;
      const onMouseMove = (e: MouseEvent) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      };
      window.addEventListener('mousemove', onMouseMove);

      const animate = () => {
        requestAnimationFrame(animate);

        particles.rotation.y += 0.0005;
        particles.rotation.x += 0.0002;

        sphere.rotation.y += 0.002;
        sphere.rotation.x += 0.001;

        // Mouse interaction
        sphere.rotation.y += mouseX * 0.01;
        sphere.rotation.x += mouseY * 0.01;

        renderer.render(scene, camera);
      };

      animate();

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', onResize);

      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('resize', onResize);
      };
    };

    initThree();
  }, [loaded]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SCROLL PROGRESS
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!loaded) return;

    const progressBar = document.querySelector('.scroll-progress') as HTMLElement;
    if (!progressBar) return;

    const onScroll = () => {
      const scrolled = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrolled / maxScroll) * 100;
      progressBar.style.width = progress + '%';
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loaded]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PRELOADER RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (!loaded) {
    return (
      <div className="preloader">
        <div className="preloader-content">
          <div className="preloader-logo">
            <span className="preloader-logo-gold">Machine</span>
            <span className="preloader-logo-white">Mind</span>
          </div>
          <div className="preloader-progress-container">
            <div className="preloader-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="preloader-text">
            <span className="preloader-percent">{Math.round(progress)}%</span>
            <span className="preloader-status">INITIALIZING NEURAL SYSTEMS</span>
          </div>
        </div>
        <style>{`
          .preloader {
            position: fixed;
            inset: 0;
            background: #06060a;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
          }
          .preloader-content {
            text-align: center;
          }
          .preloader-logo {
            font-family: 'Clash Display', sans-serif;
            font-size: clamp(32px, 6vw, 56px);
            font-weight: 600;
            margin-bottom: 48px;
            letter-spacing: -0.03em;
          }
          .preloader-logo-gold { color: #c9a96e; }
          .preloader-logo-white { color: #f0f0f3; }
          .preloader-progress-container {
            width: 200px;
            height: 1px;
            background: rgba(201, 169, 110, 0.2);
            margin: 0 auto 24px;
            overflow: hidden;
          }
          .preloader-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #c9a96e, #00e5ff);
            transition: width 0.3s ease-out;
          }
          .preloader-text {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .preloader-percent {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #c9a96e;
            letter-spacing: 0.2em;
          }
          .preloader-status {
            font-family: 'Satoshi', sans-serif;
            font-size: 9px;
            color: rgba(240, 240, 243, 0.3);
            letter-spacing: 0.4em;
            text-transform: uppercase;
          }
        `}</style>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* Custom Cursor */}
      <div ref={cursorRef} className="cursor" />
      <div ref={cursorDotRef} className="cursor-dot" />

      {/* Scroll Progress */}
      <div className="scroll-progress" />

      {/* Film Grain Overlay */}
      <svg className="film-grain" aria-hidden="true">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      {/* Vignette */}
      <div className="vignette" aria-hidden="true" />

      {/* Three.js Canvas */}
      <canvas ref={canvasRef} className="three-canvas" />

      {/* Navigation */}
      <nav className="nav">
        <a href="/" className="nav-logo magnetic">MACHINEMIND</a>
        <div className="nav-links">
          {['Systems', 'Work', 'About', 'Contact'].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="nav-link magnetic">
              {item}
            </a>
          ))}
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">AI AUTOMATION CONSULTANCY</p>
          <h1 className="hero-title">
            <span className="hero-title-line">We Build AI Systems</span>
            <span className="hero-title-line">That <em>Think</em></span>
          </h1>
          <p className="hero-subtitle">
            Autonomous intelligence infrastructure for hospitality, real estate, and private capital.
            <br />Every deployment creates unfair competitive advantage.
          </p>
          <div className="hero-cta">
            <a href="#contact" className="btn-primary magnetic">
              <span>Start a Project</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <a href="#work" className="btn-secondary magnetic">View Work</a>
          </div>
        </div>
        <div className="hero-scroll">
          <div className="hero-scroll-line" />
          <span>Scroll to explore</span>
        </div>
      </section>

      {/* Metrics Strip */}
      <section className="metrics">
        <div className="metrics-grid stagger-children">
          {[
            { value: '47', suffix: '+', label: 'Deployments' },
            { value: '120', suffix: 'K', label: 'Revenue Recovered' },
            { value: '24', suffix: '/7', label: 'AI Active' },
            { value: '93', suffix: '%', label: 'Client Retention' },
          ].map((stat, i) => (
            <div key={i} className="metric">
              <span className="metric-value counter" data-target={stat.value} data-suffix={stat.suffix}>0</span>
              <span className="metric-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Systems Section */}
      <section id="systems" className="systems">
        <div className="section-header reveal-up">
          <p className="eyebrow">WHAT WE BUILD</p>
          <h2>Three Systems. <em>Infinite Leverage.</em></h2>
        </div>
        <div className="systems-grid stagger-children">
          {[
            {
              num: '01',
              title: 'Sofia AI',
              desc: '24/7 WhatsApp concierge that qualifies leads, handles reservations, and closes while you sleep. Psychological sales intelligence built in.',
              features: ['Lead Qualification', 'Booking Automation', 'Multi-language Support', 'CRM Integration'],
            },
            {
              num: '02',
              title: 'Cinema Engine',
              desc: 'Websites that feel like films. 25 layers of scroll-driven animation, 3D environments, and behavioral design that converts.',
              features: ['GSAP ScrollTrigger', 'Three.js Integration', 'Performance Optimized', 'Mobile-First'],
            },
            {
              num: '03',
              title: 'Viceroy',
              desc: 'AI-powered investor qualification. Detects psychology, scores across 8 dimensions, routes to humans when it matters.',
              features: ['Psychology Detection', '8-Axis Scoring', 'Smart Routing', 'Deal Intelligence'],
            },
          ].map((system) => (
            <div key={system.num} className="system-card scale-on-scroll">
              <span className="system-num">{system.num}</span>
              <h3 className="system-title">{system.title}</h3>
              <p className="system-desc">{system.desc}</p>
              <ul className="system-features">
                {system.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Manifesto */}
      <section className="manifesto">
        <div className="manifesto-content reveal-up">
          <p>
            We don&apos;t build websites.<br />
            We build systems that <em>breathe</em>,<br />
            that <em>learn</em>, that <em>evolve</em>.<br />
            Every pixel has purpose.<br />
            Every interaction is choreographed.<br />
            <strong>We create what doesn&apos;t exist yet.</strong>
          </p>
        </div>
      </section>

      {/* Horizontal Scroll Showcase */}
      <section className="horizontal-scroll">
        <div className="horizontal-container">
          {[
            { title: 'Discovery', desc: 'We decode your revenue leaks and map the automation opportunity.' },
            { title: 'Architecture', desc: 'Custom AI systems designed for your specific workflows.' },
            { title: 'Build', desc: 'Rapid deployment with zero disruption to operations.' },
            { title: 'Scale', desc: 'Continuous optimization as your business grows.' },
          ].map((panel, i) => (
            <div key={i} className="horizontal-panel">
              <span className="panel-num">0{i + 1}</span>
              <h3>{panel.title}</h3>
              <p>{panel.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Work Section */}
      <section id="work" className="work">
        <div className="section-header reveal-up">
          <p className="eyebrow">SELECTED WORK</p>
          <h2>Projects That <em>Perform</em></h2>
        </div>
        <div className="work-grid stagger-children">
          {[
            { name: 'Casa Badillo', type: 'Luxury Boutique Hotel', metric: '+340% Direct Bookings' },
            { name: 'Cartagena Concierge', type: 'VIP Services', metric: '15,000+ Clients Managed' },
            { name: 'AEGIS Shield', type: 'Defense Access Control', metric: 'USMC Integration' },
            { name: 'Viceroy Capital', type: 'Investment Platform', metric: '$2.4M Qualified Deals' },
          ].map((project, i) => (
            <div key={i} className="work-item magnetic">
              <div className="work-item-content">
                <span className="work-type">{project.type}</span>
                <h3 className="work-name">{project.name}</h3>
                <span className="work-metric">{project.metric}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact">
        <div className="contact-content reveal-up">
          <p className="eyebrow">LET&apos;S BUILD</p>
          <h2>Ready to build something<br />that doesn&apos;t exist yet?</h2>
          <p className="contact-subtitle">
            We take on 3 new clients per quarter. Currently accepting projects for Q2 2026.
          </p>
          <div className="contact-cta">
            <a href="https://cal.com/machinemind" className="btn-primary magnetic" target="_blank" rel="noopener noreferrer">
              <span>Book a Discovery Call</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          <p className="contact-email">or email <a href="mailto:machinemindconsulting@gmail.com">machinemindconsulting@gmail.com</a></p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-logo">MACHINEMIND</span>
            <p className="footer-tagline">Autonomous Intelligence Infrastructure</p>
          </div>
          <div className="footer-links">
            <a href="#systems">Systems</a>
            <a href="#work">Work</a>
            <a href="#contact">Contact</a>
          </div>
          <p className="footer-copy">© 2026 MachineMind Consulting · Cartagena, Colombia</p>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════════════
          CINEMA ENGINE STYLES
          ═══════════════════════════════════════════════════════════════════════ */}
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
          --bg: #06060a;
          --fg: #f0f0f3;
          --gold: #c9a96e;
          --cyan: #00e5ff;
          --dim: rgba(240, 240, 243, 0.3);
          --glass: rgba(255, 255, 255, 0.03);
          --glass-border: rgba(255, 255, 255, 0.08);
          --font-display: 'Clash Display', sans-serif;
          --font-body: 'Satoshi', sans-serif;
          --font-serif: 'Instrument Serif', serif;
          --font-mono: 'JetBrains Mono', monospace;
        }

        html {
          background: var(--bg);
          color: var(--fg);
          scroll-behavior: smooth;
        }

        body {
          font-family: var(--font-body);
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
          cursor: none;
        }

        ::selection { background: var(--gold); color: var(--bg); }

        /* Custom Cursor */
        .cursor {
          position: fixed;
          width: 40px;
          height: 40px;
          border: 1px solid var(--gold);
          border-radius: 50%;
          pointer-events: none;
          z-index: 99999;
          transform: translate(-50%, -50%);
          transition: width 0.3s, height 0.3s, border-color 0.3s;
          mix-blend-mode: difference;
        }
        .cursor-dot {
          position: fixed;
          width: 6px;
          height: 6px;
          background: var(--gold);
          border-radius: 50%;
          pointer-events: none;
          z-index: 99999;
          transform: translate(-50%, -50%);
        }
        .cursor.cursor-hover {
          width: 60px;
          height: 60px;
          border-color: var(--cyan);
        }
        @media (max-width: 768px) {
          .cursor, .cursor-dot { display: none; }
          body { cursor: auto; }
        }

        /* Scroll Progress */
        .scroll-progress {
          position: fixed;
          top: 0;
          left: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--gold), var(--cyan));
          z-index: 9999;
          width: 0%;
        }

        /* Film Grain */
        .film-grain {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.04;
          z-index: 9998;
        }

        /* Vignette */
        .vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          box-shadow: inset 0 0 200px rgba(0, 0, 0, 0.7);
          z-index: 9997;
        }

        /* Three.js Canvas */
        .three-canvas {
          position: fixed;
          inset: 0;
          z-index: -1;
        }

        /* Navigation */
        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          padding: 24px clamp(24px, 5vw, 80px);
          display: flex;
          justify-content: space-between;
          align-items: center;
          mix-blend-mode: difference;
        }
        .nav-logo {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3em;
          color: var(--fg);
          text-decoration: none;
        }
        .nav-links {
          display: flex;
          gap: 40px;
        }
        .nav-link {
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--fg);
          text-decoration: none;
          opacity: 0.5;
          transition: opacity 0.4s;
        }
        .nav-link:hover { opacity: 1; }
        @media (max-width: 768px) {
          .nav-links { display: none; }
        }

        /* Hero */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 clamp(24px, 5vw, 80px);
          position: relative;
        }
        .hero-content { max-width: 900px; }
        .hero-eyebrow {
          font-size: 10px;
          letter-spacing: 0.5em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 24px;
        }
        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(48px, 8vw, 120px);
          font-weight: 500;
          line-height: 1.05;
          letter-spacing: -0.04em;
          margin-bottom: 32px;
        }
        .hero-title-line { display: block; }
        .hero-title em {
          font-family: var(--font-serif);
          font-style: italic;
          color: var(--gold);
        }
        .hero-subtitle {
          font-size: clamp(16px, 2vw, 20px);
          color: var(--dim);
          line-height: 1.7;
          max-width: 600px;
          margin-bottom: 48px;
        }
        .hero-cta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .hero-scroll {
          position: absolute;
          bottom: 48px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .hero-scroll-line {
          width: 1px;
          height: 60px;
          background: linear-gradient(to bottom, var(--gold), transparent);
          animation: scrollPulse 2s ease-in-out infinite;
        }
        .hero-scroll span {
          font-size: 9px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--dim);
        }
        @keyframes scrollPulse {
          0%, 100% { opacity: 0.3; transform: scaleY(0.8); }
          50% { opacity: 1; transform: scaleY(1); }
        }

        /* Buttons */
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 18px 36px;
          background: var(--gold);
          color: var(--bg);
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          text-decoration: none;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-primary:hover {
          background: var(--fg);
          transform: translateY(-2px);
        }
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          padding: 18px 36px;
          border: 1px solid var(--glass-border);
          color: var(--fg);
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          text-decoration: none;
          transition: all 0.4s;
        }
        .btn-secondary:hover {
          border-color: var(--gold);
          color: var(--gold);
        }

        /* Eyebrow */
        .eyebrow {
          font-size: 10px;
          letter-spacing: 0.5em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 16px;
        }

        /* Section Headers */
        .section-header {
          margin-bottom: 64px;
        }
        .section-header h2 {
          font-family: var(--font-display);
          font-size: clamp(36px, 5vw, 64px);
          font-weight: 500;
          letter-spacing: -0.03em;
          line-height: 1.1;
        }
        .section-header h2 em {
          font-family: var(--font-serif);
          font-style: italic;
          color: var(--gold);
        }

        /* Metrics */
        .metrics {
          padding: 0 clamp(24px, 5vw, 80px);
          border-top: 1px solid var(--glass-border);
          border-bottom: 1px solid var(--glass-border);
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 768px) {
          .metrics-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .metric {
          padding: 48px 24px;
          text-align: center;
          border-right: 1px solid var(--glass-border);
        }
        .metric:last-child { border-right: none; }
        .metric-value {
          font-family: var(--font-display);
          font-size: clamp(36px, 5vw, 56px);
          font-weight: 600;
          color: var(--fg);
          display: block;
        }
        .metric-label {
          font-size: 10px;
          letter-spacing: 0.4em;
          text-transform: uppercase;
          color: var(--dim);
          margin-top: 8px;
          display: block;
        }

        /* Systems */
        .systems {
          padding: clamp(100px, 15vh, 180px) clamp(24px, 5vw, 80px);
        }
        .systems-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
          gap: 2px;
        }
        .system-card {
          background: var(--glass);
          border: 1px solid var(--glass-border);
          padding: 48px 40px;
          position: relative;
          transition: border-color 0.4s, background 0.4s;
        }
        .system-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--gold);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .system-card:hover::before { transform: scaleX(1); }
        .system-card:hover {
          border-color: rgba(201, 169, 110, 0.3);
          background: rgba(255, 255, 255, 0.05);
        }
        .system-num {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--gold);
          letter-spacing: 0.2em;
        }
        .system-title {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 500;
          margin: 16px 0;
        }
        .system-desc {
          font-size: 15px;
          color: var(--dim);
          line-height: 1.7;
          margin-bottom: 24px;
        }
        .system-features {
          list-style: none;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .system-features li {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 8px 12px;
          background: rgba(201, 169, 110, 0.1);
          color: var(--gold);
        }

        /* Manifesto */
        .manifesto {
          padding: clamp(100px, 15vh, 180px) clamp(24px, 5vw, 80px);
          display: flex;
          justify-content: center;
        }
        .manifesto-content {
          max-width: 800px;
          text-align: center;
        }
        .manifesto-content p {
          font-family: var(--font-display);
          font-size: clamp(28px, 4vw, 48px);
          font-weight: 400;
          line-height: 1.4;
          letter-spacing: -0.02em;
        }
        .manifesto-content em {
          font-family: var(--font-serif);
          font-style: italic;
          color: var(--gold);
        }
        .manifesto-content strong {
          display: block;
          margin-top: 24px;
          color: var(--gold);
        }

        /* Horizontal Scroll */
        .horizontal-scroll {
          height: 100vh;
          overflow: hidden;
        }
        .horizontal-container {
          display: flex;
          height: 100%;
        }
        .horizontal-panel {
          min-width: 100vw;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 clamp(48px, 10vw, 200px);
          border-right: 1px solid var(--glass-border);
        }
        .panel-num {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--gold);
          letter-spacing: 0.3em;
          margin-bottom: 24px;
        }
        .horizontal-panel h3 {
          font-family: var(--font-display);
          font-size: clamp(48px, 8vw, 96px);
          font-weight: 500;
          letter-spacing: -0.04em;
          margin-bottom: 24px;
        }
        .horizontal-panel p {
          font-size: 18px;
          color: var(--dim);
          max-width: 500px;
          line-height: 1.7;
        }

        /* Work */
        .work {
          padding: clamp(100px, 15vh, 180px) clamp(24px, 5vw, 80px);
        }
        .work-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2px;
        }
        @media (max-width: 768px) {
          .work-grid { grid-template-columns: 1fr; }
        }
        .work-item {
          aspect-ratio: 16/10;
          background: var(--glass);
          border: 1px solid var(--glass-border);
          position: relative;
          overflow: hidden;
          transition: border-color 0.4s;
        }
        .work-item:hover { border-color: var(--gold); }
        .work-item-content {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 32px;
          background: linear-gradient(to top, rgba(6, 6, 10, 0.95), transparent);
        }
        .work-type {
          font-size: 10px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--gold);
        }
        .work-name {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 500;
          margin: 8px 0;
        }
        .work-metric {
          font-size: 13px;
          color: var(--dim);
        }

        /* Contact */
        .contact {
          padding: clamp(120px, 20vh, 240px) clamp(24px, 5vw, 80px);
          text-align: center;
        }
        .contact-content { max-width: 700px; margin: 0 auto; }
        .contact h2 {
          font-family: var(--font-display);
          font-size: clamp(36px, 5vw, 64px);
          font-weight: 500;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: 24px;
        }
        .contact-subtitle {
          font-size: 16px;
          color: var(--dim);
          margin-bottom: 48px;
        }
        .contact-cta { margin-bottom: 24px; }
        .contact-email {
          font-size: 14px;
          color: var(--dim);
        }
        .contact-email a {
          color: var(--gold);
          text-decoration: none;
        }
        .contact-email a:hover { text-decoration: underline; }

        /* Footer */
        .footer {
          padding: 80px clamp(24px, 5vw, 80px) 48px;
          border-top: 1px solid var(--glass-border);
        }
        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 24px;
        }
        .footer-logo {
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3em;
          color: var(--gold);
        }
        .footer-tagline {
          font-size: 11px;
          color: var(--dim);
          margin-top: 4px;
        }
        .footer-links {
          display: flex;
          gap: 32px;
        }
        .footer-links a {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--dim);
          text-decoration: none;
          transition: color 0.3s;
        }
        .footer-links a:hover { color: var(--fg); }
        .footer-copy {
          font-size: 11px;
          color: var(--dim);
          width: 100%;
          text-align: center;
          margin-top: 48px;
        }
        @media (max-width: 768px) {
          .footer-content { flex-direction: column; text-align: center; }
          .footer-links { justify-content: center; }
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: rgba(201, 169, 110, 0.3); }
        ::-webkit-scrollbar-thumb:hover { background: rgba(201, 169, 110, 0.5); }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </>
  );
}

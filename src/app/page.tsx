'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Project {
  name: string; type: string; industry: string;
  desc: string; color: string; tag?: string; url?: string;
}

/* ── Category consolidation: 19 industries → 6 filter groups ── */
const CATEGORY_MAP: Record<string, string> = {
  'Luxury Hotel': 'Hospitality',
  'Hospitality': 'Hospitality',
  'Hotel': 'Hospitality',
  'Concierge': 'Hospitality',
  'Fine Dining': 'Dining & Nightlife',
  'Restaurant': 'Dining & Nightlife',
  'Nightlife': 'Dining & Nightlife',
  'Culinary': 'Dining & Nightlife',
  'Defense': 'Defense & Enterprise',
  'Enterprise': 'Defense & Enterprise',
  'Government': 'Defense & Enterprise',
  'Travel': 'Travel & Logistics',
  'Transport': 'Travel & Logistics',
  'Events': 'Events & Media',
  'Entertainment': 'Events & Media',
  'Production': 'Events & Media',
  'Professional': 'Professional & Brands',
  'Retail': 'Professional & Brands',
  'Beauty': 'Professional & Brands',
};
const getCategory = (industry: string) => CATEGORY_MAP[industry] || industry;

const PROJECTS: Project[] = [
  // ── TIER 1: Flagship Luxury Hospitality (top of portfolio) ──
  { name: 'Poseidon Beyond Luxury', type: 'Ultra-Luxury Experience', industry: 'Luxury Hotel', desc: 'Beyond-luxury yacht and villa platform — bespoke concierge, VIP booking, experience curation', color: '#0c4a6e', url: 'https://poseidon-beyond-luxury.vercel.app' },
  { name: 'Four Seasons Bogota', type: 'AI Concierge', industry: 'Luxury Hotel', desc: 'Full-stack AI concierge with Claude SDK, booking automation, guest intel', color: '#d4af37', url: 'https://demo-fourseasons-bogota.vercel.app' },
  { name: 'Casa Boheme', type: 'Boutique Hotel Experience', industry: 'Luxury Hotel', desc: 'Bohemian luxury hospitality — immersive booking, concierge AI, guest experience design', color: '#a16207', url: 'https://casa-boheme.vercel.app' },
  { name: 'Dharma Beach Club', type: 'Luxury Beach Experience', industry: 'Hospitality', desc: 'VIP booking, Stripe payments, table reservations, event calendar', color: '#d4af37', url: 'https://dharma-topaz.vercel.app' },
  { name: 'Osaka Nikkei', type: 'Restaurant Experience', industry: 'Fine Dining', desc: 'Nikkei cuisine showcase with reservation AI, menu intelligence', color: '#ef4444', url: 'https://demo-osaka-nikkei.vercel.app' },
  { name: 'Simmer Down SV', type: 'Restaurant & Bar', industry: 'Restaurant', desc: 'Full-stack restaurant platform with online ordering, reservations, and brand experience', color: '#ea580c', url: 'https://simmerdownsv.com' },
  // ── TIER 2: Defense & Enterprise (locked) ──
  { name: 'AEGIS Shield', type: 'Defense & Access Control', industry: 'Defense', desc: 'USMC DBIDS overlay — biometric gate control, AI threat scoring, command mesh', color: '#1c4a5e', tag: 'CLASSIFIED' },
  { name: 'VoxLink', type: 'Voice Intelligence Platform', industry: 'Enterprise', desc: 'Real-time voice AI with Daily.co, conversation analytics, Stripe billing', color: '#7c3aed', tag: 'ENTERPRISE' },
  { name: 'ReWired OS', type: 'Business Operating System', industry: 'Enterprise', desc: 'CRM + outreach pipeline + email drip + analytics dashboard', color: '#10b981', tag: 'ENTERPRISE' },
  { name: 'MovVia', type: 'Logistics Command Center', industry: 'Enterprise', desc: 'Drag-and-drop fleet ops, route optimization, driver dispatch AI', color: '#00B4FF', tag: 'ENTERPRISE' },
  { name: 'El Salvador National', type: 'National Platform', industry: 'Government', desc: 'Government-scale digital platform, citizen services, data pipeline', color: '#0369a1', tag: 'ENTERPRISE' },
  { name: 'Ania Consular', type: 'Consular Services', industry: 'Government', desc: 'Document processing, appointment scheduling, status tracking AI', color: '#1d4ed8', tag: 'ENTERPRISE' },
  // ── TIER 3: Hospitality & Dining ──
  { name: 'Frenessi', type: 'Brand & Pitch Platform', industry: 'Professional', desc: 'High-impact pitch deck platform with Cinema Engine animations, investor-ready storytelling', color: '#dc2626', url: 'https://frenessi-pitch.vercel.app' },
  { name: 'Cafe Noir', type: 'Premium Cafe', industry: 'Restaurant', desc: 'Dark luxury cafe branding, online ordering, loyalty system', color: '#92400e', url: 'https://demo-cafenoir.vercel.app' },
  { name: 'La Kasta', type: 'Nightlife & Dining', industry: 'Nightlife', desc: 'VIP table booking, event management, bottle service automation', color: '#a855f7', url: 'https://demo-lakasta.vercel.app' },
  { name: 'Chef Jose', type: 'Personal Chef Brand', industry: 'Culinary', desc: 'Private dining experience site, booking pipeline, menu showcase', color: '#f97316', url: 'https://demo-chefjose.vercel.app' },
  { name: 'Alambique', type: 'Bar & Cocktail Lounge', industry: 'Restaurant', desc: 'Cocktail menu AI, event booking, atmosphere-first design', color: '#b45309', url: 'https://demo-alambique.vercel.app' },
  { name: 'Tutaina', type: 'Latin Gastro Bar', industry: 'Restaurant', desc: 'Music-driven dining experience, reservation system, event pipeline', color: '#dc2626', url: 'https://demo-tutaina.vercel.app' },
  { name: 'Simmer Down Pizza', type: 'Interactive Restaurant', industry: 'Restaurant', desc: 'Canvas-based interactive menu, Easter eggs, gamified ordering', color: '#f97316', url: 'https://simmer-down.vercel.app' },
  // ── TIER 4: Hotels & Concierge ──
  { name: 'Villareal', type: 'Boutique Hospitality', industry: 'Hotel', desc: 'Luxury villa booking, concierge integration, guest experience AI', color: '#059669', url: 'https://demo-villareal.vercel.app' },
  { name: 'Confort', type: 'Hospitality Platform', industry: 'Hotel', desc: 'Comfort-first hotel experience, smart check-in, service automation', color: '#0284c7', url: 'https://demo-confort.vercel.app' },
  { name: 'MDC Boutique', type: 'Boutique Hotel', industry: 'Luxury Hotel', desc: 'Boutique hotel management, guest profiling, automated concierge', color: '#c9a96e', tag: 'ENTERPRISE' },
  { name: 'Medellin VIP', type: 'Concierge Services', industry: 'Concierge', desc: 'VIP experience curation, booking orchestration, 24/7 AI concierge', color: '#7c3aed', url: 'https://demo-medellinvip.vercel.app' },
  { name: 'World Lion', type: 'Travel & Concierge', industry: 'Travel', desc: 'Global travel coordination, itinerary AI, luxury experience booking', color: '#b45309', url: 'https://demo-worldlion.vercel.app' },
  { name: '100 Luxury', type: 'Luxury Concierge', industry: 'Concierge', desc: 'Ultra-premium concierge platform, wealth-tier service automation', color: '#c9a96e', tag: 'ENTERPRISE' },
  { name: 'Cartagena Concierge', type: 'City Concierge', industry: 'Concierge', desc: 'Full city concierge system — restaurants, tours, transport, nightlife', color: '#10b981', tag: 'ENTERPRISE' },
  // ── TIER 5: Transport ──
  { name: 'BenzDriver', type: 'Luxury Transport', industry: 'Transport', desc: 'Premium chauffeur booking, fleet management, VIP client routing', color: '#1e3a5f', url: 'https://demo-benzdriver.vercel.app' },
  { name: 'Aerotransfer', type: 'Airport Transfers', industry: 'Transport', desc: 'Airport pickup automation, flight tracking, WhatsApp confirmation', color: '#0891b2', url: 'https://demo-aerotransfer.vercel.app' },
  // ── TIER 6: Events & Entertainment ──
  { name: 'The Vibe with Herflo', type: 'Event Venue', industry: 'Events', desc: 'Venue booking, event management, artist coordination, ticket system', color: '#e11d48', url: 'https://the-vibe-with-herflo.vercel.app' },
  { name: 'BlackSound', type: 'Music & Events', industry: 'Entertainment', desc: 'Artist booking platform, event production, sound design showcase', color: '#18181b', url: 'https://demo-blacksound.vercel.app' },
  { name: 'Next Producciones', type: 'Event Production', industry: 'Production', desc: 'Full production company site, portfolio, booking pipeline', color: '#6366f1', url: 'https://demo-nextproducciones.vercel.app' },
  { name: 'Toque Eventos', type: 'Event Management', industry: 'Events', desc: 'End-to-end event platform — planning, vendor coordination, day-of ops', color: '#f59e0b', tag: 'ENTERPRISE' },
  // ── TIER 7: Professional & Brands ──
  { name: 'Angelica Valencia', type: 'Personal Brand', industry: 'Professional', desc: 'Professional portfolio, booking system, content showcase', color: '#ec4899', url: 'https://demo-angelica-valencia.vercel.app' },
  { name: 'Jota Pardo', type: 'Personal Brand', industry: 'Professional', desc: 'Creative portfolio with Cinema Engine, booking integration', color: '#8b5cf6', url: 'https://demo-jota-pardo.vercel.app' },
  { name: 'MariaEu', type: 'Personal Brand', industry: 'Professional', desc: 'Lifestyle brand platform, content management, audience engagement', color: '#f472b6', url: 'https://demo-mariaeu.vercel.app' },
  { name: 'Coach D', type: 'Coaching Platform', industry: 'Professional', desc: 'Session booking, progress tracking, content delivery, payment system', color: '#14b8a6', tag: 'ENTERPRISE' },
  { name: 'Seven7Times', type: 'Brand & Retail', industry: 'Retail', desc: 'E-commerce foundation, brand storytelling, product showcase', color: '#1e293b', url: 'https://demo-seven7times.vercel.app' },
  { name: 'Rizos', type: 'Salon & Beauty', industry: 'Beauty', desc: 'Appointment booking AI, stylist matching, service menu, loyalty rewards', color: '#d946ef', url: 'https://demo-rizos.vercel.app' },
];

const CATEGORIES = ['All', ...Array.from(new Set(PROJECTS.map(p => getCategory(p.industry))))];

export default function Home() {
  const [ready, setReady] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [visibleProjects, setVisibleProjects] = useState(18);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reelRef = useRef<HTMLVideoElement>(null);
  const gsapReady = useRef(false);

  const filteredProjects = activeFilter === 'All'
    ? PROJECTS : PROJECTS.filter(p => getCategory(p.industry) === activeFilter);

  // ── VIDEO READY → fade in site (1.5s max wait) ──
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onReady = () => setReady(true);
    if (v.readyState >= 3) { setReady(true); return; }
    v.addEventListener('canplay', onReady);
    const fallback = setTimeout(() => setReady(true), 1500);
    return () => { v.removeEventListener('canplay', onReady); clearTimeout(fallback); };
  }, []);

  // ── REEL: autoplay when scrolled into view ──
  useEffect(() => {
    const reel = reelRef.current;
    if (!reel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { reel.play().catch(() => {}); }
        else { reel.pause(); }
      },
      { threshold: 0.3 }
    );
    observer.observe(reel);
    return () => observer.disconnect();
  }, [ready]);

  // ── Force-show content fallback if GSAP fails ──
  const forceShowAll = useCallback(() => {
    document.querySelectorAll('.hero-eyebrow,.hero-title-line,.hero-subtitle,.hero-cta-wrap,.hero-scroll-indicator,.reveal-up,.scale-in').forEach(el => {
      const h = el as HTMLElement;
      h.style.opacity = '1';
      h.style.transform = 'none';
    });
    document.querySelectorAll('.stagger-children').forEach(c => {
      Array.from(c.children).forEach(el => {
        const h = el as HTMLElement;
        h.style.opacity = '1';
        h.style.transform = 'none';
      });
    });
  }, []);

  // ── GSAP ANIMATIONS (robust with error handling + fallback) ──
  useEffect(() => {
    if (!ready) return;
    let destroyed = false;

    const init = async () => {
      try {
        const gsapModule = await import('gsap');
        const gsap = gsapModule.default;
        const { ScrollTrigger } = await import('gsap/ScrollTrigger');
        gsap.registerPlugin(ScrollTrigger);
        if (destroyed) return;
        gsapReady.current = true;

        // ── NAV + PROGRESS ──
        const nav = document.querySelector('.nav') as HTMLElement;
        const bar = document.querySelector('.scroll-progress') as HTMLElement;
        window.addEventListener('scroll', () => {
          const scrollY = window.scrollY;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          if (nav) nav.style.background = scrollY > 60 ? 'rgba(6,6,10,0.92)' : 'transparent';
          if (bar) bar.style.transform = `scaleX(${(scrollY / Math.max(1, maxScroll))})`;
        }, { passive: true });

        // ── HERO ENTRANCE ──
        const tl = gsap.timeline({ delay: 0.2 });
        tl.from('.hero-eyebrow', { y: 30, opacity: 0, duration: 0.8, ease: 'power4.out' })
          .from('.hero-title-line', { y: 80, opacity: 0, duration: 1, stagger: 0.12, ease: 'power4.out' }, '-=0.5')
          .from('.hero-subtitle', { y: 25, opacity: 0, duration: 0.7, ease: 'power3.out' }, '-=0.4')
          .from('.hero-cta-wrap', { y: 15, opacity: 0, duration: 0.5, ease: 'power3.out' }, '-=0.3')
          .from('.hero-scroll-indicator', { opacity: 0, duration: 0.8 }, '-=0.2');

        // ── HERO PARALLAX ──
        gsap.to('.hero-content', {
          y: -120, opacity: 0,
          scrollTrigger: { trigger: '.hero', start: 'top top', end: '60% top', scrub: true },
        });
        gsap.to('.hero-scroll-indicator', {
          opacity: 0,
          scrollTrigger: { trigger: '.hero', start: '15% top', end: '35% top', scrub: true },
        });

        // ── REVEAL ANIMATIONS ──
        gsap.utils.toArray<HTMLElement>('.reveal-up').forEach((el) => {
          gsap.from(el, {
            y: 40, opacity: 0, duration: 0.7, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
          });
        });

        gsap.utils.toArray<HTMLElement>('.stagger-children').forEach((container) => {
          gsap.from(container.children, {
            y: 25, opacity: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out',
            scrollTrigger: { trigger: container, start: 'top 85%', toggleActions: 'play none none none' },
          });
        });

        // ── COUNTERS ──
        gsap.utils.toArray<HTMLElement>('.counter').forEach((el) => {
          const target = parseInt(el.dataset.target || '0');
          const obj = { val: 0 };
          gsap.to(obj, {
            val: target, duration: 2, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' },
            onUpdate: () => { el.textContent = Math.round(obj.val) + (el.dataset.suffix || ''); },
          });
        });

        // ── DIVIDERS ──
        gsap.utils.toArray<HTMLElement>('.section-divider').forEach((el) => {
          gsap.fromTo(el, { scaleX: 0 }, {
            scaleX: 1, duration: 1.2, ease: 'power3.inOut',
            scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' },
          });
        });

        // ── SCALE-IN ──
        gsap.utils.toArray<HTMLElement>('.scale-in').forEach((el) => {
          gsap.from(el, {
            scale: 0.97, opacity: 0, duration: 0.6, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
          });
        });
      } catch (err) {
        console.error('[GSAP]', err);
        forceShowAll();
      }
    };

    init();

    // Watchdog: if GSAP hasn't finished in 4s, force everything visible
    const watchdog = setTimeout(() => {
      if (!gsapReady.current) forceShowAll();
    }, 4000);

    return () => { destroyed = true; clearTimeout(watchdog); };
  }, [ready, forceShowAll]);

  return (
    <>
      {/* ═══ VIDEO BACKGROUND ═══ */}
      <video
        ref={videoRef}
        className="vid-bg"
        autoPlay muted loop playsInline
        preload="auto"
      >
        <source src="/ship.webm" type="video/webm" />
        <source src="/ship.mp4" type="video/mp4" />
      </video>
      <div className="vid-overlay" />

      {/* ═══ PRELOADER ═══ */}
      <div className={`preloader ${ready ? 'preloader-gone' : ''}`}>
        <div className="preloader-content">
          <div className="preloader-logo">
            <span className="pl-gold">Machine</span><span className="pl-white">Mind</span>
          </div>
          <div className="pl-bar-wrap"><div className="pl-bar" /></div>
        </div>
      </div>

      {/* ═══ SCROLL PROGRESS ═══ */}
      <div className="scroll-progress" />

      {/* ═══ NAVIGATION ═══ */}
      <nav className="nav">
        <a href="/" className="nav-logo">
          <span className="nav-logo-gold">MACHINE</span><span>MIND</span>
        </a>
        <div className="nav-links">
          {['Systems', 'Portfolio', 'Process', 'About', 'Contact'].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`} className="nav-link">{item}</a>
          ))}
        </div>
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
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
            AI that sells, books, qualifies, and operates 24/7 — deployed across {PROJECTS.length} custom systems and counting.
          </p>
          <p className="hero-subtitle-2">
            We don&apos;t build tools. We build unfair advantages.
          </p>
          <div className="hero-cta-wrap">
            <a href="#contact" className="btn-primary">
              <span>Start a Project</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
            <a href="#portfolio" className="btn-ghost">View Portfolio</a>
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
            { value: '111', suffix: '+', label: 'Systems Deployed' },
            { value: '38', suffix: '', label: 'Custom Builds' },
            { value: '98', suffix: '%', label: 'Client Retention' },
            { value: '4', suffix: 'wk', label: 'Avg Delivery' },
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
              { num: '01', title: 'Sofia AI', icon: '////', desc: 'WhatsApp AI that qualifies leads, handles bookings, detects psychology, and closes deals 24/7. Six mental models. Escalation intelligence. Revenue generation on autopilot.', features: ['WhatsApp API', 'Psych Sales', 'Lead Scoring', 'Auto-Escalation', 'CRM Sync', 'Multi-Language'], metric: '24/7 Revenue Generation' },
              { num: '02', title: 'Cinema Engine', icon: '[][]', desc: 'Websites that feel like films. 25 layers of scroll-driven animation, Three.js environments, GSAP choreography. Every pixel is engineered to convert visitors into clients.', features: ['GSAP ScrollTrigger', 'Three.js', 'Scroll Video', 'Physics', 'Perf A+', 'Mobile-First'], metric: '25-Layer Cinematic System' },
              { num: '03', title: 'Viceroy', icon: '><><', desc: 'AI-powered investor qualification. Detects intent, scores across 8 dimensions, routes to humans when stakes are high. Autonomous deal flow at scale.', features: ['Psychology AI', '8-Axis Score', 'Email Drip', 'Smart Route', 'Deal Intel', 'Pipeline'], metric: 'Autonomous Deal Flow' },
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

      {/* ═══ COMMERCIAL REEL ═══ */}
      <section className="reel-section">
        <div className="reel-inner reveal-up">
          <video
            ref={reelRef}
            className="reel-video"
            muted loop playsInline
            preload="metadata"
          >
            <source src="/mm-commercial.mp4" type="video/mp4" />
          </video>
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
            {CATEGORIES.map(cat => (
              <button key={cat} className={`filter-btn ${activeFilter === cat ? 'active' : ''}`}
                onClick={() => { setActiveFilter(cat); setVisibleProjects(18); }}>{cat}</button>
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
                      {p.url ? <>View Live <span className="arr" /></> : 'Private Access'}
                    </span>
                  </div>
                </div>
              );
              return p.url ? (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="portfolio-card" style={{ '--ac': p.color } as React.CSSProperties}>{inner}</a>
              ) : (
                <div key={i} className="portfolio-card" style={{ '--ac': p.color } as React.CSSProperties}>{inner}</div>
              );
            })}
          </div>
          {visibleProjects < filteredProjects.length && (
            <div className="load-more reveal-up">
              <button className="btn-ghost" onClick={() => setVisibleProjects(v => v + 18)}>
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
            <p className="section-desc">From first call to production deployment in weeks, not months.</p>
          </div>
          <div className="process-grid stagger-children">
            {[
              { n: '01', t: 'Discovery', d: 'We decode your revenue leaks, map automation opportunities, and identify the highest-ROI AI deployment. You get a full diagnostic with a prioritized roadmap.', detail: 'Week 1 — Diagnostic & Strategy' },
              { n: '02', t: 'Architecture', d: 'Custom system design — database schemas, AI pipelines, integration maps, security policies. Every component is purpose-built for your specific business logic.', detail: 'Week 2 — Technical Blueprint' },
              { n: '03', t: 'Build & Ship', d: 'Rapid deployment with Cinema Engine aesthetics. TypeScript strict, Supabase RLS, Vercel edge. You see a working demo within days, not months.', detail: 'Weeks 2-4 — Live Deployment' },
              { n: '04', t: 'Scale & Learn', d: 'Continuous optimization as your AI learns your business. Performance monitoring, A/B testing, and system expansion. Your competitors wonder what happened.', detail: 'Ongoing — Compound Growth' },
            ].map(p => (
              <div key={p.n} className="process-card scale-in">
                <span className="proc-num">{p.n}</span>
                <h3 className="proc-title">{p.t}</h3>
                <span className="proc-detail">{p.detail}</span>
                <p className="proc-desc">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MANIFESTO ═══ */}
      <section className="manifesto">
        <div className="manifesto-inner">
          <div className="manifesto-line" />
          <div className="manifesto-content reveal-up">
            <p>We don&apos;t build websites.</p>
            <p>We build systems that <em>breathe</em>,</p>
            <p>that <em>learn</em>, that <em>compound</em>.</p>
            <p>Every deployment is a moat.</p>
            <p>Every pixel is choreographed.</p>
            <p className="manifesto-strong">We create what doesn&apos;t exist yet.</p>
          </div>
          <div className="manifesto-line" />
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
            <p className="about-founder">Founded by Phil McGill</p>
            <p>MachineMind is an AI automation consultancy that builds autonomous intelligence infrastructure for businesses that refuse to operate manually.</p>
            <p>We specialize in hospitality, real estate, private capital, and high-touch service industries where every missed message is lost revenue.</p>
            <p className="about-location">Based in Cartagena, Colombia — deploying worldwide for clients across the Americas, Europe, and the Middle East.</p>
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
          <div className="contact-grid">
            <div className="contact-cta">
              <a href="https://cal.com/machinemind" className="btn-primary" target="_blank" rel="noopener noreferrer">
                <span>Book a Discovery Call</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
              <p className="contact-email">or email <a href="mailto:Phil@machinemindconsulting.com">Phil@machinemindconsulting.com</a></p>
            </div>
            <form className="contact-form" action="https://formsubmit.co/Phil@machinemindconsulting.com" method="POST">
              <input type="hidden" name="_subject" value="New Project Inquiry — MachineMind" />
              <input type="hidden" name="_template" value="table" />
              <input type="hidden" name="_captcha" value="false" />
              <input type="text" name="name" placeholder="Your name" required className="form-input" />
              <input type="email" name="email" placeholder="Email address" required className="form-input" />
              <select name="project_type" required className="form-input form-select">
                <option value="" disabled selected>Project type</option>
                <option value="WhatsApp AI Assistant">WhatsApp AI Assistant</option>
                <option value="Cinema Engine Website">Cinema Engine Website</option>
                <option value="Full Stack (AI + Website)">Full Stack (AI + Website)</option>
                <option value="Enterprise / Custom">Enterprise / Custom</option>
              </select>
              <textarea name="message" placeholder="Tell us about your project..." rows={3} className="form-input form-textarea" />
              <button type="submit" className="btn-ghost form-submit">Send Inquiry</button>
            </form>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo"><span className="fl-gold">MACHINE</span>MIND</span>
            <p className="footer-tag">Autonomous Intelligence Infrastructure</p>
          </div>
          <div className="footer-links">
            {['Systems','Portfolio','Process','About','Contact'].map(l => (
              <a key={l} href={`#${l.toLowerCase()}`}>{l}</a>
            ))}
          </div>
          <div className="footer-social">
            <a href="https://linkedin.com/company/machinemindconsulting" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://x.com/machinemindai" target="_blank" rel="noopener noreferrer" aria-label="X">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://instagram.com/machinemindconsulting" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
          </div>
          <p className="footer-copy">&copy; 2026 MachineMind Consulting &middot; Cartagena, Colombia</p>
        </div>
      </footer>

      <style>{STYLES}</style>
    </>
  );
}

const STYLES = `
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#06060a;--fg:#f0f0f3;--gold:#c9a96e;
  --dim:rgba(240,240,243,0.35);--glass:rgba(6,6,10,0.88);
  --gb:rgba(255,255,255,0.08);
  --fd:'Clash Display',sans-serif;--fb:'Satoshi',sans-serif;
  --fs:'Instrument Serif',serif;--fm:'JetBrains Mono',monospace;
}
html{background:var(--bg);color:var(--fg)}
body{font-family:var(--fb);overflow-x:hidden;-webkit-font-smoothing:antialiased}
::selection{background:var(--gold);color:var(--bg)}

/* ═══ VIDEO BACKGROUND ═══ */
.vid-bg{position:fixed;top:0;left:0;width:100vw;height:100vh;object-fit:cover;z-index:0}
.vid-overlay{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1;
  background:radial-gradient(ellipse at 50% 40%,rgba(6,6,10,0.15) 0%,rgba(6,6,10,0.5) 100%);
  pointer-events:none}

/* ═══ PRELOADER ═══ */
.preloader{position:fixed;inset:0;z-index:99999;background:#06060a;display:flex;align-items:center;justify-content:center;
  transition:opacity .6s ease,visibility .6s}
.preloader-gone{opacity:0;visibility:hidden;pointer-events:none}
.preloader-content{text-align:center}
.preloader-logo{font-family:var(--fd);font-size:clamp(36px,7vw,64px);font-weight:600;margin-bottom:40px;letter-spacing:-0.03em}
.pl-gold{color:var(--gold)}.pl-white{color:var(--fg)}
.pl-bar-wrap{width:120px;height:1px;background:rgba(255,255,255,0.08);margin:0 auto;overflow:hidden}
.pl-bar{width:100%;height:100%;background:var(--gold);animation:pl-slide 1.2s ease-in-out infinite}
@keyframes pl-slide{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}

/* ═══ SCROLL PROGRESS — solid gold ═══ */
.scroll-progress{position:fixed;top:0;left:0;height:2px;width:100%;background:var(--gold);z-index:9999;transform:scaleX(0);transform-origin:left}

/* ═══ NAV ═══ */
.nav{position:fixed;top:0;left:0;right:0;z-index:1000;padding:20px clamp(24px,5vw,80px);display:flex;justify-content:space-between;align-items:center;transition:background .3s}
.nav-logo{font-family:var(--fb);font-size:11px;font-weight:700;letter-spacing:.3em;color:var(--fg);text-decoration:none}
.nav-logo-gold{color:var(--gold)}
.nav-links{display:flex;gap:36px}
.nav-link{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--fg);text-decoration:none;opacity:.4;transition:opacity .3s}
.nav-link:hover{opacity:1}
.nav-hamburger{display:none;background:none;border:none;width:28px;height:20px;position:relative;z-index:1001;cursor:pointer}
.hb-line{display:block;width:100%;height:1px;background:var(--fg);position:absolute;left:0;transition:all .3s}
.hb-line:first-child{top:4px}.hb-line:last-child{bottom:4px}
.hb-line.open:first-child{top:50%;transform:rotate(45deg)}.hb-line.open:last-child{bottom:50%;transform:rotate(-45deg)}
@media(max-width:768px){.nav-links{display:none}.nav-hamburger{display:block}}
.mobile-menu{position:fixed;inset:0;background:rgba(6,6,10,0.97);z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px}
.mm-link{font-family:var(--fd);font-size:32px;font-weight:500;color:var(--fg);text-decoration:none;opacity:.6;transition:opacity .3s,color .3s}
.mm-link:hover{opacity:1;color:var(--gold)}

/* ═══ CONTENT Z-INDEX ═══ */
.hero,.metrics,.section-dark,.manifesto,.site-footer,.section-divider,.mobile-menu{position:relative;z-index:5}

/* ═══ HERO ═══ */
.hero{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 clamp(24px,5vw,80px)}
.hero-content{max-width:1000px}
.hero-eyebrow{font-size:10px;letter-spacing:.6em;text-transform:uppercase;color:var(--gold);margin-bottom:28px}
.hero-title{font-family:var(--fd);font-size:clamp(44px,8vw,110px);font-weight:500;line-height:1.02;letter-spacing:-.04em;margin-bottom:36px;text-shadow:0 4px 60px rgba(0,0,0,0.6)}
.hero-title-line{display:block}
.hero-title em{font-family:var(--fs);font-style:italic;color:var(--gold)}
.hero-subtitle{font-size:clamp(15px,1.8vw,19px);color:var(--dim);line-height:1.8;max-width:580px;margin-bottom:12px;text-shadow:0 2px 30px rgba(0,0,0,0.5)}
.hero-subtitle-2{font-size:clamp(15px,1.8vw,19px);color:var(--fg);line-height:1.8;max-width:580px;margin-bottom:48px;font-weight:500;text-shadow:0 2px 30px rgba(0,0,0,0.5)}
.hero-cta-wrap{display:flex;gap:16px;flex-wrap:wrap}
.hero-scroll-indicator{position:absolute;bottom:40px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:12px}
.scroll-line{width:1px;height:56px;background:linear-gradient(to bottom,var(--gold),transparent);animation:sp 2s ease-in-out infinite}
.hero-scroll-indicator span{font-size:8px;letter-spacing:.4em;text-transform:uppercase;color:var(--dim)}
@keyframes sp{0%,100%{opacity:.3;transform:scaleY(.7)}50%{opacity:1;transform:scaleY(1)}}

/* ═══ BUTTONS ═══ */
.btn-primary{display:inline-flex;align-items:center;gap:12px;padding:18px 36px;background:var(--gold);color:var(--bg);font-family:var(--fb);font-size:11px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;cursor:pointer;transition:all .4s cubic-bezier(.4,0,.2,1);border:none}
.btn-primary:hover{background:var(--fg);transform:translateY(-2px)}
.btn-ghost{display:inline-flex;align-items:center;padding:18px 36px;border:1px solid rgba(255,255,255,0.15);color:var(--fg);font-family:var(--fb);font-size:11px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;background:none;cursor:pointer;transition:all .4s}
.btn-ghost:hover{border-color:var(--gold);color:var(--gold)}

/* ═══ SHARED ═══ */
.eyebrow{font-size:10px;letter-spacing:.5em;text-transform:uppercase;color:var(--gold);margin-bottom:16px}
.section-header{margin-bottom:48px}
.section-header h2{font-family:var(--fd);font-size:clamp(32px,5vw,60px);font-weight:500;letter-spacing:-.03em;line-height:1.1}
.section-header h2 em{font-family:var(--fs);font-style:italic;color:var(--gold)}
.section-desc{font-size:16px;color:var(--dim);line-height:1.7;max-width:560px;margin-top:16px}
.section-dark{background:var(--glass)}
.section-inner{padding:clamp(80px,12vh,140px) clamp(24px,5vw,80px)}
.section-divider{height:1px;margin:0 clamp(24px,5vw,80px);background:linear-gradient(90deg,transparent,var(--gold),transparent);transform-origin:center;opacity:.3;position:relative;z-index:5}

/* ═══ METRICS ═══ */
.metrics{padding:0 clamp(24px,5vw,80px);border-top:1px solid var(--gb);border-bottom:1px solid var(--gb);background:rgba(6,6,10,0.92)}
.metrics-grid{display:grid;grid-template-columns:repeat(4,1fr)}
@media(max-width:768px){.metrics-grid{grid-template-columns:repeat(2,1fr)}}
.metric{padding:44px 24px;text-align:center;border-right:1px solid var(--gb)}
.metric:last-child{border-right:none}
.metric-value{font-family:var(--fd);font-size:clamp(36px,5vw,56px);font-weight:600;display:block}
.metric-label{font-size:9px;letter-spacing:.4em;text-transform:uppercase;color:var(--dim);margin-top:8px;display:block}

/* ═══ SYSTEMS ═══ */
.systems-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:2px}
.system-card{background:rgba(6,6,10,0.75);border:1px solid var(--gb);padding:48px 40px;position:relative;transition:border-color .4s,background .4s}
.system-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--gold);transform:scaleX(0);transform-origin:left;transition:transform .6s cubic-bezier(.4,0,.2,1)}
.system-card:hover::before{transform:scaleX(1)}
.system-card:hover{border-color:rgba(201,169,110,0.3);background:rgba(255,255,255,0.04)}
.sys-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.sys-num{font-family:var(--fm);font-size:11px;color:var(--gold);letter-spacing:.2em}
.sys-icon{font-family:var(--fm);font-size:11px;color:var(--dim)}
.sys-title{font-family:var(--fd);font-size:28px;font-weight:500;margin-bottom:8px}
.sys-metric{font-size:11px;color:var(--gold);letter-spacing:.15em;text-transform:uppercase;margin-bottom:20px}
.sys-desc{font-size:16px;color:var(--dim);line-height:1.7;margin-bottom:28px}
.sys-features{list-style:none;display:flex;flex-wrap:wrap;gap:6px}
.sys-features li{font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:7px 11px;background:rgba(201,169,110,0.08);color:var(--gold)}

/* ═══ PORTFOLIO ═══ */
.filter-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:48px}
.filter-btn{font-family:var(--fb);font-size:10px;letter-spacing:.15em;text-transform:uppercase;padding:10px 18px;background:none;border:1px solid var(--gb);color:var(--dim);cursor:pointer;transition:all .3s}
.filter-btn:hover,.filter-btn.active{border-color:var(--gold);color:var(--gold)}
.filter-btn.active{background:rgba(201,169,110,0.1)}
.portfolio-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px}
@media(max-width:1024px){.portfolio-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.portfolio-grid{grid-template-columns:1fr}}
.portfolio-card{aspect-ratio:16/10;background:rgba(6,6,10,0.75);border:1px solid var(--gb);position:relative;overflow:hidden;transition:all .5s cubic-bezier(.4,0,.2,1);text-decoration:none;display:block}
.portfolio-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,var(--ac,var(--gold)) 0%,transparent 60%);opacity:.06;transition:opacity .5s}
.portfolio-card:hover::before{opacity:.18}
.portfolio-card:hover{border-color:var(--ac,var(--gold));transform:translateY(-4px)}
.card-inner{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:28px}
.card-top{display:flex;justify-content:space-between;align-items:flex-start}
.card-ind{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
.card-tag{font-size:8px;letter-spacing:.2em;text-transform:uppercase;color:var(--bg);background:var(--gold);padding:4px 8px}
.card-bot{margin-top:auto}
.card-type{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--ac,var(--gold))}
.card-name{font-family:var(--fd);font-size:clamp(20px,2vw,26px);font-weight:500;margin:6px 0;color:var(--fg)}
.card-desc{font-size:14px;color:var(--dim);line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
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
.process-card{background:rgba(6,6,10,0.75);border:1px solid var(--gb);padding:48px 36px;position:relative;transition:border-color .4s,background .4s}
.process-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--gold);transform:scaleX(0);transform-origin:left;transition:transform .6s cubic-bezier(.4,0,.2,1)}
.process-card:hover::before{transform:scaleX(1)}
.process-card:hover{border-color:rgba(201,169,110,0.2);background:rgba(255,255,255,0.04)}
.proc-num{font-family:var(--fm);font-size:11px;color:var(--gold);letter-spacing:.3em;display:block;margin-bottom:24px}
.proc-title{font-family:var(--fd);font-size:24px;font-weight:500;margin-bottom:8px}
.proc-detail{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:20px}
.proc-desc{font-size:16px;color:var(--dim);line-height:1.7}

/* ═══ REEL ═══ */
.reel-section{position:relative;z-index:5;overflow:hidden}
.reel-inner{display:flex;justify-content:center;padding:clamp(60px,10vh,120px) clamp(24px,5vw,80px);background:rgba(6,6,10,0.6)}
.reel-video{width:100%;max-width:420px;aspect-ratio:9/16;object-fit:cover;border:1px solid rgba(201,169,110,0.2)}

/* ═══ MANIFESTO ═══ */
.manifesto{padding:clamp(100px,15vh,200px) clamp(24px,5vw,80px);display:flex;justify-content:center}
.manifesto-inner{max-width:800px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:48px}
.manifesto-line{width:1px;height:80px;background:linear-gradient(to bottom,transparent,var(--gold),transparent);opacity:.4}
.manifesto-content p{font-family:var(--fd);font-size:clamp(24px,3.5vw,44px);font-weight:400;line-height:1.5;letter-spacing:-.02em;text-shadow:0 4px 40px rgba(0,0,0,0.7)}
.manifesto-content em{font-family:var(--fs);font-style:italic;color:var(--gold)}
.manifesto-strong{color:var(--gold);margin-top:16px;font-weight:500}

/* ═══ ABOUT ═══ */
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:start}
@media(max-width:768px){.about-grid{grid-template-columns:1fr;gap:40px}}
.about-left h2{font-family:var(--fd);font-size:clamp(32px,4vw,52px);font-weight:500;letter-spacing:-.03em;line-height:1.15}
.about-left h2 em{font-family:var(--fs);font-style:italic;color:var(--gold)}
.about-founder{font-family:var(--fd);font-size:18px;font-weight:500;color:var(--gold);margin-bottom:20px}
.about-right p{font-size:16px;color:var(--dim);line-height:1.8;margin-bottom:20px}
.about-location{font-size:14px;color:rgba(240,240,243,0.25);font-style:italic}
.stack-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:28px}
.stack-tag{font-size:9px;letter-spacing:.15em;text-transform:uppercase;padding:8px 14px;border:1px solid var(--gb);color:var(--dim);transition:all .3s}
.stack-tag:hover{border-color:var(--gold);color:var(--gold)}

/* ═══ CONTACT ═══ */
.contact-section{text-align:center}
.contact-inner{max-width:900px;margin:0 auto;display:flex;flex-direction:column;align-items:center}
.contact-inner h2{font-family:var(--fd);font-size:clamp(34px,5vw,60px);font-weight:500;letter-spacing:-.03em;line-height:1.1;margin-bottom:24px}
.contact-sub{font-size:16px;color:var(--dim);margin-bottom:48px}
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;width:100%;text-align:left}
@media(max-width:768px){.contact-grid{grid-template-columns:1fr;gap:32px;text-align:center}}
.contact-cta{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}
.contact-email{font-size:14px;color:var(--dim)}
.contact-email a{color:var(--gold);text-decoration:none}
.contact-email a:hover{text-decoration:underline}
.contact-form{display:flex;flex-direction:column;gap:12px}
.form-input{background:rgba(255,255,255,0.04);border:1px solid var(--gb);padding:14px 18px;font-family:var(--fb);font-size:14px;color:var(--fg);outline:none;transition:border-color .3s}
.form-input::placeholder{color:var(--dim)}
.form-input:focus{border-color:var(--gold)}
.form-select{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c9a96e' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 16px center}
.form-select option{background:var(--bg);color:var(--fg)}
.form-textarea{resize:vertical;min-height:80px}
.form-submit{width:100%;justify-content:center}

/* ═══ FOOTER ═══ */
.site-footer{padding:72px clamp(24px,5vw,80px) 40px;border-top:1px solid var(--gb);background:rgba(6,6,10,0.95)}
.footer-inner{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:24px}
.footer-brand{}
.footer-logo{font-family:var(--fb);font-size:11px;font-weight:700;letter-spacing:.3em}
.fl-gold{color:var(--gold)}
.footer-tag{font-size:10px;color:var(--dim);margin-top:4px}
.footer-links{display:flex;gap:28px}
.footer-links a{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--dim);text-decoration:none;transition:color .3s}
.footer-links a:hover{color:var(--gold)}
.footer-social{display:flex;gap:16px;align-items:center}
.footer-social a{color:var(--dim);transition:color .3s;display:flex;align-items:center}
.footer-social a:hover{color:var(--gold)}
.footer-copy{font-size:11px;color:rgba(240,240,243,0.15);width:100%;text-align:center;margin-top:24px}
@media(max-width:768px){.footer-inner{flex-direction:column;text-align:center}.footer-links{justify-content:center;flex-wrap:wrap}.footer-social{justify-content:center}}
`;

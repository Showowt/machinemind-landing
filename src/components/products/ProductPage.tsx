"use client";

import { useEffect, useRef, useState } from "react";
import {
  getProductBySlug,
  BOOK_URL,
  CONTACT_EMAIL,
  type Lang,
  type Loc,
} from "@/lib/products-data";

const LANG_KEY = "mm-lang";

export default function ProductPage({ slug }: { slug: string }) {
  const product = getProductBySlug(slug);
  const [lang, setLang] = useState<Lang>("es");
  const rootRef = useRef<HTMLDivElement>(null);

  // Restore saved language after mount (avoids hydration mismatch).
  useEffect(() => {
    const saved = (typeof window !== "undefined" && window.localStorage.getItem(LANG_KEY)) as Lang | null;
    if (saved === "en" || saved === "es") setLang(saved);
  }, []);

  const toggleLang = () => {
    setLang((prev) => {
      const next: Lang = prev === "es" ? "en" : "es";
      try {
        window.localStorage.setItem(LANG_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Scroll-progress bar + nav background on scroll.
  useEffect(() => {
    const onScroll = () => {
      const root = rootRef.current;
      if (!root) return;
      const bar = root.querySelector<HTMLElement>(".pp-progress");
      const nav = root.querySelector<HTMLElement>(".pp-nav");
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      if (nav) nav.classList.toggle("scrolled", y > 40);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Reveal-on-scroll — IntersectionObserver with no-support + watchdog fallbacks.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    if (!els.length) return;

    const showAll = () => els.forEach((el) => el.classList.add("in"));

    if (typeof IntersectionObserver === "undefined") {
      showAll();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    const watchdog = window.setTimeout(showAll, 3500);
    return () => {
      io.disconnect();
      window.clearTimeout(watchdog);
    };
  }, []);

  if (!product) return null;

  const t = (l: Loc) => l[lang];

  // Deterministic hero-entrance stagger (no render-time mutation).
  const d = (i: number) => ({ animationDelay: `${0.05 + i * 0.09}s` });

  const headline = product.headline[lang];

  return (
    <div ref={rootRef} className="pp" style={{ "--accent": product.accent } as React.CSSProperties}>
      <div className="pp-progress" />

      {/* ── NAV ── */}
      <nav className="pp-nav">
        <a href="/" className="pp-wordmark" aria-label="MachineMind — Inicio">
          <span className="pp-wm-arrow">←</span>
          <span className="pp-wm-gold">MACHINE</span>
          <span>MIND</span>
        </a>
        <div className="pp-nav-right">
          <button className="pp-lang" onClick={toggleLang} aria-label="Switch language">
            {lang === "es" ? "EN" : "ES"}
          </button>
          <a className="pp-nav-cta" href={BOOK_URL} target="_blank" rel="noopener noreferrer">
            {lang === "es" ? "Agendar" : "Book a call"}
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="pp-hero">
        <div className="pp-hero-glow" />
        <div className="pp-hero-inner">
          <div className="pp-brandrow hero-fx" style={d(0)}>
            <span className="pp-brand">
              {product.brand}
              {product.brandAccentWord ? <span className="pp-brand-accent"> {product.brandAccentWord}</span> : null}
            </span>
            {product.badge ? <span className="pp-badge">{product.badge}</span> : null}
          </div>
          <p className="pp-eyebrow hero-fx" style={d(1)}>
            {t(product.eyebrow)}
          </p>
          <h1 className="pp-title">
            {headline.map((line, i) => (
              <span key={i} className={`pp-line hero-fx${line.em ? " em" : ""}`} style={d(2 + i)}>
                {line.t}
              </span>
            ))}
          </h1>
          <p className="pp-sub hero-fx" style={d(2 + headline.length)}>
            {t(product.sub)}
          </p>
          <div className="pp-cta-row hero-fx" style={d(3 + headline.length)}>
            <a className="pp-btn-primary" href={BOOK_URL} target="_blank" rel="noopener noreferrer">
              {lang === "es" ? "Agendar una llamada" : "Book a call"}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            {product.liveUrl && product.liveLabel ? (
              <a className="pp-btn-ghost" href={product.liveUrl} target="_blank" rel="noopener noreferrer">
                {t(product.liveLabel)}
              </a>
            ) : (
              <a className="pp-btn-ghost" href={`mailto:${CONTACT_EMAIL}`}>
                {lang === "es" ? "Escríbenos" : "Email us"}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── METRICS ── */}
      <section className="pp-metrics">
        {product.metrics.map((m, i) => (
          <div key={i} className="pp-metric reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
            <span className="pp-metric-v">{m.value}</span>
            <span className="pp-metric-l">{t(m.label)}</span>
          </div>
        ))}
      </section>

      {/* ── PROBLEM ── */}
      <section className="pp-problem">
        <p className="pp-label reveal">{lang === "es" ? "El problema" : "The problem"}</p>
        <h2 className="pp-problem-title reveal">{t(product.problem.title)}</h2>
        <p className="pp-problem-body reveal">{t(product.problem.body)}</p>
      </section>

      {/* ── STEPS ── */}
      <section className="pp-steps">
        <p className="pp-label reveal">{t(product.stepsLabel)}</p>
        <div className="pp-steps-grid">
          {product.steps.map((s, i) => (
            <div key={i} className="pp-step reveal" style={{ transitionDelay: `${i * 0.06}s` }}>
              <span className="pp-step-n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{t(s.title)}</h3>
              <p>{t(s.body)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section className="pp-caps">
        <p className="pp-label reveal">{t(product.capabilitiesLabel)}</p>
        <div className="pp-caps-grid">
          {product.capabilities.map((c, i) => (
            <div key={i} className="pp-cap reveal" style={{ transitionDelay: `${(i % 3) * 0.06}s` }}>
              <h3>{t(c.title)}</h3>
              <p>{t(c.body)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROOF ── */}
      <section className="pp-proof">
        <div className="pp-proof-inner reveal">
          <h2>{t(product.proof.title)}</h2>
          <p>{t(product.proof.body)}</p>
          <div className="pp-chips">
            {product.proof.chips.map((c, i) => (
              <span key={i} className="pp-chip">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLOSING CTA ── */}
      <section className="pp-cta">
        <h2 className="reveal">{t(product.cta.title)}</h2>
        <p className="reveal">{t(product.cta.body)}</p>
        <div className="pp-cta-row reveal">
          <a className="pp-btn-primary" href={BOOK_URL} target="_blank" rel="noopener noreferrer">
            {lang === "es" ? "Agendar una llamada" : "Book a call"}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
          <a className="pp-btn-ghost" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="pp-footer">
        <a href="/" className="pp-foot-brand">
          <span className="pp-wm-gold">Machine</span>Mind
        </a>
        <span className="pp-foot-tag">
          {lang === "es"
            ? "Consultoría de Automatización con IA · Cartagena"
            : "AI Automation Consultancy · Cartagena"}
        </span>
        <div className="pp-foot-links">
          <a href="/">{lang === "es" ? "Inicio" : "Home"}</a>
          <a href={BOOK_URL} target="_blank" rel="noopener noreferrer">
            {lang === "es" ? "Agendar" : "Book a call"}
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`}>Email</a>
        </div>
      </footer>

      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
.pp{
  --bg:#06060a; --fg:#f0f0f3; --gold:#c9a96e;
  --dim:rgba(240,240,243,0.38); --dim2:rgba(240,240,243,0.6);
  --line:rgba(255,255,255,0.08); --card:rgba(255,255,255,0.025);
  --fd:'Clash Display',sans-serif; --fb:'Satoshi',sans-serif;
  --fs:'Instrument Serif',serif; --fm:'JetBrains Mono',monospace;
  background:var(--bg); color:var(--fg); font-family:var(--fb);
  min-height:100vh; position:relative; overflow-x:hidden; line-height:1.6;
}
.pp *{box-sizing:border-box}
.pp a{color:inherit; text-decoration:none}
.pp ::selection{background:var(--accent); color:var(--bg)}

/* progress */
.pp-progress{position:fixed; top:0; left:0; height:2px; width:100%; background:var(--accent);
  z-index:100; transform:scaleX(0); transform-origin:left; will-change:transform}

/* nav */
.pp-nav{position:fixed; top:0; left:0; right:0; z-index:90; display:flex; align-items:center;
  justify-content:space-between; padding:0 clamp(20px,5vw,72px); height:64px;
  background:transparent; border-bottom:1px solid transparent; transition:background .4s, border-color .4s}
.pp-nav.scrolled{background:rgba(6,6,10,0.88); backdrop-filter:blur(14px); border-bottom-color:var(--line)}
.pp-wordmark{display:flex; align-items:center; gap:6px; font-family:var(--fb); font-size:12px;
  font-weight:700; letter-spacing:.28em}
.pp-wm-arrow{color:var(--dim); font-weight:400; letter-spacing:0; margin-right:4px; transition:color .3s}
.pp-wordmark:hover .pp-wm-arrow{color:var(--accent)}
.pp-wm-gold{color:var(--gold)}
.pp-nav-right{display:flex; align-items:center; gap:14px}
.pp-lang{background:none; border:1px solid var(--line); color:var(--dim2); font-family:var(--fm);
  font-size:11px; letter-spacing:.1em; padding:7px 12px; cursor:pointer; transition:all .3s}
.pp-lang:hover{color:var(--fg); border-color:var(--accent)}
.pp-nav-cta{font-family:var(--fb); font-size:12px; font-weight:600; letter-spacing:.04em;
  padding:9px 18px; background:var(--accent); color:var(--bg); transition:opacity .3s}
.pp-nav-cta:hover{opacity:.85}

/* hero */
.pp-hero{position:relative; min-height:clamp(600px,90vh,880px); display:flex; flex-direction:column;
  justify-content:center; padding:120px clamp(20px,5vw,72px) 80px; overflow:hidden}
.pp-hero-glow{position:absolute; top:-10%; left:50%; transform:translateX(-50%); width:min(1100px,120vw);
  height:620px; background:radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 62%);
  pointer-events:none; z-index:0}
.pp-hero-inner{position:relative; z-index:1; max-width:980px}
.pp-brandrow{display:flex; align-items:center; gap:14px; margin-bottom:26px}
.pp-brand{font-family:var(--fd); font-size:clamp(20px,2.4vw,26px); font-weight:600; letter-spacing:-.02em}
.pp-brand-accent{color:var(--accent)}
.pp-badge{font-family:var(--fm); font-size:10px; letter-spacing:.18em; text-transform:uppercase;
  color:var(--accent); border:1px solid color-mix(in srgb,var(--accent) 40%, transparent);
  padding:5px 10px; background:color-mix(in srgb,var(--accent) 8%, transparent)}
.pp-eyebrow{font-family:var(--fm); font-size:12px; letter-spacing:.22em; text-transform:uppercase;
  color:var(--dim2); margin-bottom:22px}
.pp-title{font-family:var(--fd); font-weight:500; letter-spacing:-.035em; line-height:1.04;
  font-size:clamp(38px,6.6vw,84px); margin-bottom:28px; display:flex; flex-direction:column}
.pp-line{display:block}
.pp-line.em{font-family:var(--fs); font-style:italic; font-weight:400; color:var(--accent); letter-spacing:-.01em}
.pp-sub{font-size:clamp(16px,1.5vw,20px); color:var(--dim2); max-width:640px; margin-bottom:38px; line-height:1.65}
.pp-cta-row{display:flex; flex-wrap:wrap; gap:14px; align-items:center}
.pp-btn-primary{display:inline-flex; align-items:center; gap:10px; font-family:var(--fb); font-size:15px;
  font-weight:600; padding:15px 26px; background:var(--accent); color:var(--bg); transition:transform .25s, filter .25s}
.pp-btn-primary:hover{transform:translateY(-2px); filter:brightness(1.08)}
.pp-btn-ghost{display:inline-flex; align-items:center; gap:8px; font-family:var(--fb); font-size:15px;
  font-weight:500; padding:15px 24px; color:var(--fg); border:1px solid var(--line); transition:border-color .3s, color .3s}
.pp-btn-ghost:hover{border-color:var(--accent); color:var(--accent)}

/* hero entrance */
.hero-fx{animation:ppHeroIn .85s cubic-bezier(.16,.84,.44,1) both}
@keyframes ppHeroIn{from{opacity:0; transform:translateY(26px)} to{opacity:1; transform:none}}

/* reveal */
.reveal{opacity:0; transform:translateY(24px); transition:opacity .7s ease, transform .7s ease}
.reveal.in{opacity:1; transform:none}

/* section rhythm */
.pp section{padding:clamp(70px,9vw,130px) clamp(20px,5vw,72px)}
.pp-label{font-family:var(--fm); font-size:11px; letter-spacing:.24em; text-transform:uppercase;
  color:var(--accent); margin-bottom:34px}

/* metrics */
.pp-metrics{display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--line);
  border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:0 !important}
.pp-metric{background:var(--bg); padding:clamp(32px,4vw,52px) clamp(20px,3vw,40px); display:flex; flex-direction:column; gap:10px}
.pp-metric-v{font-family:var(--fd); font-size:clamp(30px,4vw,50px); font-weight:600; letter-spacing:-.03em; color:var(--accent); line-height:1}
.pp-metric-l{font-size:13px; color:var(--dim2); line-height:1.4}

/* problem */
.pp-problem{max-width:980px; margin:0 auto}
.pp-problem-title{font-family:var(--fd); font-weight:500; letter-spacing:-.03em; line-height:1.12;
  font-size:clamp(28px,4vw,52px); margin-bottom:28px; max-width:16ch}
.pp-problem-body{font-size:clamp(16px,1.4vw,19px); color:var(--dim2); max-width:60ch; line-height:1.7}

/* steps */
.pp-steps-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:clamp(20px,2.4vw,36px)}
.pp-step{border-top:1px solid var(--line); padding-top:24px}
.pp-step-n{font-family:var(--fm); font-size:13px; color:var(--accent); letter-spacing:.1em}
.pp-step h3{font-family:var(--fd); font-size:clamp(17px,1.6vw,21px); font-weight:600; letter-spacing:-.02em; margin:16px 0 12px; line-height:1.2}
.pp-step p{font-size:14.5px; color:var(--dim2); line-height:1.6}

/* capabilities */
.pp-caps-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:var(--line); border:1px solid var(--line)}
.pp-cap{background:var(--bg); padding:clamp(26px,3vw,40px); transition:background .35s}
.pp-cap:hover{background:var(--card)}
.pp-cap h3{font-family:var(--fd); font-size:clamp(17px,1.5vw,20px); font-weight:600; letter-spacing:-.02em; margin-bottom:12px; line-height:1.2}
.pp-cap h3::before{content:""; display:block; width:26px; height:2px; background:var(--accent); margin-bottom:16px}
.pp-cap p{font-size:14.5px; color:var(--dim2); line-height:1.6}

/* proof */
.pp-proof{background:linear-gradient(180deg, rgba(255,255,255,0.015), transparent)}
.pp-proof-inner{max-width:880px; margin:0 auto; text-align:center}
.pp-proof-inner h2{font-family:var(--fd); font-weight:500; letter-spacing:-.03em; line-height:1.14;
  font-size:clamp(26px,3.4vw,44px); margin-bottom:24px}
.pp-proof-inner p{font-size:clamp(15px,1.3vw,18px); color:var(--dim2); max-width:62ch; margin:0 auto 36px; line-height:1.7}
.pp-chips{display:flex; flex-wrap:wrap; gap:12px; justify-content:center}
.pp-chip{font-family:var(--fm); font-size:12px; letter-spacing:.06em; color:var(--dim2);
  border:1px solid var(--line); padding:9px 15px; transition:border-color .3s, color .3s}
.pp-chip:hover{border-color:var(--accent); color:var(--fg)}

/* closing cta */
.pp-cta{text-align:center; border-top:1px solid var(--line)}
.pp-cta h2{font-family:var(--fd); font-weight:500; letter-spacing:-.03em; line-height:1.12;
  font-size:clamp(28px,4.4vw,56px); max-width:18ch; margin:0 auto 20px}
.pp-cta>p{font-size:clamp(16px,1.4vw,19px); color:var(--dim2); margin:0 auto 38px; max-width:52ch}
.pp-cta .pp-cta-row{justify-content:center}

/* footer */
.pp-footer{display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:18px;
  padding:40px clamp(20px,5vw,72px); border-top:1px solid var(--line); background:rgba(6,6,10,0.6)}
.pp-foot-brand{font-family:var(--fd); font-size:18px; font-weight:600; letter-spacing:-.02em}
.pp-foot-tag{font-size:11px; color:var(--dim); letter-spacing:.04em}
.pp-foot-links{display:flex; gap:24px}
.pp-foot-links a{font-family:var(--fm); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); transition:color .3s}
.pp-foot-links a:hover{color:var(--accent)}

/* responsive */
@media(max-width:860px){
  .pp-metrics{grid-template-columns:repeat(2,1fr)}
  .pp-steps-grid{grid-template-columns:repeat(2,1fr)}
  .pp-caps-grid{grid-template-columns:1fr}
}
@media(max-width:560px){
  .pp-metrics{grid-template-columns:1fr}
  .pp-steps-grid{grid-template-columns:1fr}
  .pp-nav-cta{display:none}
  .pp-footer{flex-direction:column; text-align:center; align-items:center}
}
@media(prefers-reduced-motion:reduce){
  .reveal{opacity:1; transform:none; transition:none}
  .hero-fx{animation:none}
}
`;

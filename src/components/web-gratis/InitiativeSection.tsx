'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { TRANSLATIONS, type Lang } from '@/lib/i18n-content';
import { MM_WHATSAPP, WEB_GRATIS_PATH } from '@/lib/web-gratis/config';
import { formatWhatsAppDisplay, whatsAppHref } from './whatsapp-display';

/**
 * Home-page section for the Business Digitalization Initiative 2026 (free
 * websites for businesses in El Salvador and Colombia). Uses the home page's
 * shared classes (section-dark, section-inner, section-header, eyebrow,
 * reveal-up, card-animate) so it animates with the page's own GSAP / observer
 * system; everything else is scoped under .wgi.
 *
 * Framing rules: MachineMind's own initiative, aligned with each government's
 * vision — never presented as a government program. The disclaimer is always
 * rendered in both languages.
 */

export const INITIATIVE_SECTION_ID = 'web-gratis';

interface InitiativeSectionProps {
  lang: Lang;
  /** Reports whether any part of the section is on screen. */
  onVisibleChange?: (visible: boolean) => void;
  /**
   * Fired when the visitor actually interacts with the section (presses a
   * control or moves keyboard focus into it). Deliberately not hover: the
   * pointer sweeps across a full-width section on every scroll.
   */
  onEngage?: () => void;
}

interface CountryEntry {
  key: 'sv' | 'co';
  dial: string;
  href: string;
}

const COUNTRIES: readonly CountryEntry[] = [
  { key: 'sv', dial: '+503', href: `${WEB_GRATIS_PATH}?pais=sv` },
  { key: 'co', dial: '+57', href: `${WEB_GRATIS_PATH}?pais=co` },
];

export default function InitiativeSection({ lang, onVisibleChange, onEngage }: InitiativeSectionProps) {
  const t = TRANSLATIONS[lang].initiative;
  const altLang: Lang = lang === 'es' ? 'en' : 'es';
  const altDisclaimer = TRANSLATIONS[altLang].initiative.disclaimer;
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !onVisibleChange || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => onVisibleChange(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      onVisibleChange(false);
    };
  }, [onVisibleChange]);

  return (
    <section
      id={INITIATIVE_SECTION_ID}
      ref={sectionRef}
      className="section-dark wgi"
      aria-labelledby="wgi-title"
      onPointerDown={onEngage}
      onFocusCapture={onEngage}
    >
      <div className="section-inner">
        <p className="eyebrow wgi-eyebrow reveal-up">
          <span className="wgi-dot" aria-hidden="true" />
          {t.eyebrow}
        </p>
        <div className="wgi-head">
          <div className="section-header wgi-header reveal-up">
            <h2 id="wgi-title">
              {t.headingPrefix} <em>{t.headingItalic}</em>
            </h2>
            <p className="section-desc">{t.desc}</p>
          </div>

          <div className="wgi-vision reveal-up">
            <p className="wgi-label">{t.visionLabel}</p>
            {COUNTRIES.map(({ key }) => (
              <div key={key} className="wgi-line">
                <span className="wgi-country">{t[key].name}</span>
                <p className="wgi-quote">{t[key].line}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="wgi-block">
          <p className="wgi-label">{t.offerLabel}</p>
          {/* Index keys on purpose: the copy changes with the language toggle, and a
              text key would remount the .card-animate cells, which then sit at
              opacity 0 until the 3.5s CSS fallback (the page's observer never sees them). */}
          <ol className="wgi-offer">
            {t.offers.map((o, i) => (
              <li
                key={i}
                className="wgi-offer-cell card-animate"
                style={{ '--delay': `${i * 0.1}s` } as CSSProperties}
              >
                <span className="wgi-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="wgi-offer-value">{o.value}</span>
                <span className="wgi-offer-label">{o.label}</span>
                <span className="wgi-offer-note">{o.note}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="wgi-block">
          <p className="wgi-label">{t.stepsLabel}</p>
          <ol className="wgi-steps">
            {t.steps.map((s, i) => (
              <li
                key={i}
                className="wgi-step card-animate"
                style={{ '--delay': `${i * 0.12}s` } as CSSProperties}
              >
                <span className="wgi-num wgi-step-num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="wgi-step-title">{s.title}</h3>
                <p className="wgi-step-note">{s.note}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="wgi-block wgi-cta reveal-up">
          <p className="wgi-label">{t.ctaLabel}</p>
          <div className="wgi-cta-grid">
            {COUNTRIES.map(({ key, dial, href }) => (
              <a key={key} href={href} className="wgi-country-cta">
                <span className="wgi-cc-top">
                  <span className="wgi-cc-name">{t[key].name}</span>
                  <span className="wgi-cc-dial">{dial}</span>
                </span>
                <span className="wgi-cc-label">{t[key].cta}</span>
                <span className="wgi-cc-sub">
                  {t.ctaSub}
                  <span className="wgi-arr" aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
          <p className="wgi-wa">
            {t.whatsappPrompt}{' '}
            <a href={whatsAppHref(MM_WHATSAPP, t.whatsappText)} target="_blank" rel="noopener noreferrer">
              {formatWhatsAppDisplay(MM_WHATSAPP)}
            </a>
          </p>
        </div>

        <div className="wgi-fine">
          <p lang={lang}>{t.disclaimer}</p>
          <p lang={altLang} className="wgi-fine-alt">{altDisclaimer}</p>
        </div>
      </div>
      <style>{SECTION_CSS}</style>
    </section>
  );
}

const SECTION_CSS = `
.wgi{
  --w-gold:var(--gold,#c9a96e);--w-fg:var(--fg,#f0f0f3);--w-bg:var(--bg,#06060a);
  --w-dim:var(--dim,rgba(240,240,243,0.35));--w-gb:var(--gb,rgba(255,255,255,0.08));
  --w-fd:var(--fd,'Clash Display',sans-serif);--w-fb:var(--fb,'Satoshi',sans-serif);
  --w-fs:var(--fs,'Instrument Serif',serif);--w-fm:var(--fm,'JetBrains Mono',monospace);
  border-top:1px solid rgba(201,169,110,0.18);border-bottom:1px solid rgba(201,169,110,0.18)}
.section-dark.wgi{background:
  radial-gradient(ellipse 60% 45% at 88% 0%,rgba(201,169,110,0.09),transparent 70%),
  radial-gradient(ellipse 50% 40% at 0% 100%,rgba(0,229,255,0.035),transparent 70%),
  var(--glass,rgba(6,6,10,0.88))}

/* Head: pitch + vision */
.wgi-head{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:clamp(40px,6vw,96px);align-items:end}
.wgi-header{margin-bottom:0}
.wgi-header h2{font-size:clamp(32px,4.4vw,56px)}
.wgi-eyebrow{display:flex;align-items:center;gap:12px;letter-spacing:.3em;line-height:1.8;margin-bottom:28px}
.wgi-dot{width:6px;height:6px;border-radius:50%;background:var(--w-gold);flex-shrink:0;animation:pulse 2s ease-in-out infinite}
.wgi-vision{border-left:1px solid rgba(201,169,110,0.4);padding-left:clamp(20px,3vw,36px)}
.wgi-label{font-family:var(--w-fm);font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--w-dim);
  padding-bottom:14px;border-bottom:1px solid var(--w-gb);margin-bottom:24px}
.wgi-vision .wgi-label{border-bottom:none;padding-bottom:0;margin-bottom:20px}
.wgi-line+.wgi-line{margin-top:24px}
.wgi-country{display:flex;align-items:center;gap:10px;font-family:var(--w-fm);font-size:10px;letter-spacing:.3em;
  text-transform:uppercase;color:var(--w-gold);margin-bottom:8px}
.wgi-country::before{content:'';width:18px;height:1px;background:var(--w-gold)}
.wgi-quote{font-family:var(--w-fs);font-style:italic;font-size:clamp(20px,2.1vw,27px);line-height:1.35;color:var(--w-fg)}

/* Blocks */
.wgi-block{margin-top:clamp(56px,8vh,88px)}
.wgi-num{font-family:var(--w-fm);font-size:11px;color:var(--w-gold);letter-spacing:.3em;display:block}

/* Offer ladder */
.wgi-offer{list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:auto;gap:2px}
/* Subgrid keeps number / value / label / note on shared baselines across a row
   (a two-line value no longer pushes one label below its neighbours). */
.wgi-offer-cell{position:relative;grid-row:span 4;display:grid;grid-template-rows:subgrid;row-gap:0;align-content:start;
  background:rgba(6,6,10,0.75);border:1px solid var(--w-gb);padding:36px 28px;transition:border-color .4s,background .4s}
.wgi-offer-cell::before,.wgi-step::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--w-gold);
  transform:scaleX(0);transform-origin:left;transition:transform .6s cubic-bezier(.4,0,.2,1)}
.wgi-offer-cell:hover::before,.wgi-step:hover::before{transform:scaleX(1)}
.wgi-offer-cell:hover,.wgi-step:hover{border-color:rgba(201,169,110,0.25);background:rgba(255,255,255,0.04)}
.wgi-offer-value{font-family:var(--w-fd);font-size:clamp(28px,3vw,42px);font-weight:500;letter-spacing:-.03em;line-height:1.1;
  color:var(--w-fg);margin:22px 0 12px}
.wgi-offer-label{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--w-gold);margin-bottom:12px;line-height:1.5}
.wgi-offer-note{font-size:14px;color:var(--w-dim);line-height:1.65}

/* Steps */
.wgi-steps{list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px}
.wgi-step{position:relative;background:rgba(6,6,10,0.75);border:1px solid var(--w-gb);padding:40px 32px;transition:border-color .4s,background .4s}
.wgi-step-num{display:flex;align-items:center;gap:14px;margin-bottom:22px}
.wgi-step-num::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(201,169,110,0.5),transparent)}
.wgi-step-title{font-family:var(--w-fd);font-size:22px;font-weight:500;line-height:1.25;letter-spacing:-.01em;margin-bottom:10px}
.wgi-step-note{font-size:15px;color:var(--w-dim);line-height:1.7}

/* Country CTAs: 1px gold border, fill slides up, text inverts */
.wgi-cta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px}
.wgi-country-cta{position:relative;isolation:isolate;overflow:hidden;display:flex;flex-direction:column;gap:12px;
  padding:32px 32px 28px;background:rgba(6,6,10,0.75);border:1px solid rgba(201,169,110,0.45);
  color:var(--w-fg);text-decoration:none;transition:color .45s cubic-bezier(.4,0,.2,1),border-color .45s}
.wgi-country-cta::before{content:'';position:absolute;inset:0;z-index:-1;background:var(--w-gold);transform:translateY(101%);
  transition:transform .5s cubic-bezier(.4,0,.2,1)}
.wgi-country-cta:hover,.wgi-country-cta:focus-visible,.wgi-country-cta:active{color:var(--w-bg);border-color:var(--w-gold)}
.wgi-country-cta:hover::before,.wgi-country-cta:focus-visible::before,.wgi-country-cta:active::before{transform:translateY(0)}
.wgi-country-cta:focus-visible{outline:1px solid var(--w-gold);outline-offset:3px}
.wgi-cc-top{display:flex;justify-content:space-between;align-items:center;gap:12px;font-family:var(--w-fm);font-size:10px;
  letter-spacing:.3em;text-transform:uppercase;color:var(--w-gold);transition:color .45s}
.wgi-cc-dial{letter-spacing:.12em;opacity:.7}
.wgi-cc-label{font-family:var(--w-fd);font-size:clamp(26px,3vw,40px);font-weight:500;letter-spacing:-.03em;line-height:1.1}
.wgi-cc-sub{display:inline-flex;align-items:center;gap:10px;font-size:11px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;
  color:var(--w-gold);transition:color .45s}
.wgi-country-cta:hover .wgi-cc-top,.wgi-country-cta:hover .wgi-cc-sub,
.wgi-country-cta:focus-visible .wgi-cc-top,.wgi-country-cta:focus-visible .wgi-cc-sub,
.wgi-country-cta:active .wgi-cc-top,.wgi-country-cta:active .wgi-cc-sub{color:var(--w-bg)}
.wgi-arr{display:inline-block;position:relative;width:16px;height:1px;background:currentColor;transition:transform .35s}
.wgi-arr::after{content:'';position:absolute;right:0;top:-3px;width:6px;height:6px;border-right:1px solid currentColor;
  border-top:1px solid currentColor;transform:rotate(45deg)}
.wgi-country-cta:hover .wgi-arr,.wgi-country-cta:focus-visible .wgi-arr{transform:translateX(4px)}
.wgi-wa{margin-top:22px;font-size:14px;line-height:1.7;color:var(--w-dim)}
.wgi-wa a{color:var(--w-gold);text-decoration:none;white-space:nowrap;border-bottom:1px solid rgba(201,169,110,0.35);transition:border-color .3s}
.wgi-wa a:hover,.wgi-wa a:focus-visible{border-color:var(--w-gold)}

/* Required disclaimer */
.wgi-fine{margin-top:56px;padding-top:20px;border-top:1px solid var(--w-gb)}
/* Small, but legible: this is the line that keeps the framing truthful */
.wgi-fine p{font-size:11.5px;line-height:1.7;color:rgba(240,240,243,0.55);max-width:780px}
.wgi-fine .wgi-fine-alt{color:rgba(240,240,243,0.42);margin-top:6px}

@media(max-width:1024px){
  .wgi-offer{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:900px){
  .wgi-head{grid-template-columns:1fr;gap:40px;align-items:start}
  .wgi-steps{grid-template-columns:1fr}
}
@media(max-width:640px){
  .wgi-eyebrow{letter-spacing:.22em;align-items:flex-start}
  .wgi-dot{margin-top:6px}
  .wgi-offer-cell{padding:26px 18px}
  .wgi-offer-value{font-size:24px;margin:16px 0 10px}
  .wgi-offer-note{font-size:13px}
  .wgi-step{padding:30px 22px}
  .wgi-step-title{font-size:20px}
  .wgi-cta-grid{grid-template-columns:1fr}
  .wgi-country-cta{padding:26px 22px 22px}
}
@media(prefers-reduced-motion:reduce){.wgi-dot{animation:none}}
`;

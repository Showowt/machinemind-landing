'use client';

import { useEffect, useRef } from 'react';
import { TRANSLATIONS, type Lang } from '@/lib/i18n-content';
import { WEB_GRATIS_PATH } from '@/lib/web-gratis/config';

/**
 * Slim, always-on announcement bar for the free-website initiative.
 * Fixed to the very top of the viewport; publishes its rendered height as the
 * CSS custom property --mm-ib-h on <html> so the page can offset its fixed nav,
 * hero and mobile menu. Breakpoint defaults below cover the first paint before
 * hydration (SSR), then the measured value takes over.
 */

const HEIGHT_VAR = '--mm-ib-h';

interface InitiativeBarProps {
  lang: Lang;
  /**
   * Fired when the visitor presses or focuses the bar. Never on hover: the bar
   * spans the top edge, so every pointer heading for the browser's tabs or URL
   * bar crosses it — hover-engagement would silently disable exit intent for
   * every desktop visitor.
   */
  onEngage?: () => void;
}

export default function InitiativeBar({ lang, onEngage }: InitiativeBarProps) {
  const t = TRANSLATIONS[lang].initiativeBar;
  const barRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
      root.style.setProperty(HEIGHT_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    publish();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', publish);
      return () => {
        window.removeEventListener('resize', publish);
        root.style.removeProperty(HEIGHT_VAR);
      };
    }
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(HEIGHT_VAR);
    };
  }, []);

  return (
    <>
      <a
        ref={barRef}
        href={WEB_GRATIS_PATH}
        className="wgb"
        onPointerDown={onEngage}
        onFocus={onEngage}
      >
        <span className="wgb-in">
          <span className="wgb-tag">
            <span className="wgb-dot" aria-hidden="true" />
            {t.tag}
          </span>
          <span className="wgb-sep" aria-hidden="true" />
          <span className="wgb-row">
            <span className="wgb-text wgb-long">{t.text}</span>
            <span className="wgb-text wgb-short">{t.short}</span>
            <span className="wgb-cta">
              {t.cta}
              <span className="wgb-arr" aria-hidden="true" />
            </span>
          </span>
        </span>
      </a>
      <style>{BAR_CSS}</style>
    </>
  );
}

const BAR_CSS = `
:root{--mm-ib-h:39px}
@media(max-width:900px){:root{--mm-ib-h:46px}}
.wgb{position:fixed;top:0;left:0;right:0;z-index:1002;display:block;overflow:hidden;text-decoration:none;
  color:var(--fg,#f0f0f3);
  background:linear-gradient(90deg,rgba(6,6,10,0.97) 0%,rgba(16,13,9,0.97) 50%,rgba(6,6,10,0.97) 100%);
  border-bottom:1px solid rgba(201,169,110,0.22);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.wgb::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;
  background:linear-gradient(90deg,transparent,var(--gold,#c9a96e),transparent);opacity:.6;
  transform:translateX(-100%);animation:wgb-sweep 7s ease-in-out infinite;pointer-events:none}
@keyframes wgb-sweep{0%{transform:translateX(-100%)}55%,100%{transform:translateX(100%)}}
.wgb-in{position:relative;display:flex;align-items:center;justify-content:center;gap:14px;
  min-height:38px;padding:0 clamp(16px,5vw,80px)}
.wgb-tag{display:inline-flex;align-items:center;gap:8px;flex-shrink:0;white-space:nowrap;
  font-family:var(--fm,'JetBrains Mono',monospace);font-size:9.5px;line-height:12px;font-weight:500;
  letter-spacing:.22em;text-transform:uppercase;color:var(--gold,#c9a96e)}
.wgb-dot{width:6px;height:6px;border-radius:50%;background:var(--gold,#c9a96e);flex-shrink:0;
  animation:wgb-pulse 2s ease-in-out infinite}
@keyframes wgb-pulse{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}
.wgb-sep{width:1px;height:12px;background:rgba(255,255,255,0.14);flex-shrink:0}
.wgb-row{display:flex;align-items:center;gap:14px;min-width:0;max-width:100%}
.wgb-text{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
  font-family:var(--fb,'Satoshi',sans-serif);font-size:12.5px;line-height:17px;color:rgba(240,240,243,0.8)}
.wgb-short{display:none}
.wgb-cta{display:inline-flex;align-items:center;gap:8px;flex-shrink:0;white-space:nowrap;padding-bottom:2px;
  font-family:var(--fb,'Satoshi',sans-serif);font-size:10px;line-height:12px;font-weight:600;
  letter-spacing:.18em;text-transform:uppercase;color:var(--gold,#c9a96e);
  border-bottom:1px solid rgba(201,169,110,0.35);transition:color .3s,border-color .3s}
.wgb-arr{display:inline-block;position:relative;width:12px;height:1px;background:currentColor;transition:transform .3s}
.wgb-arr::after{content:'';position:absolute;right:0;top:-3px;width:6px;height:6px;
  border-right:1px solid currentColor;border-top:1px solid currentColor;transform:rotate(45deg)}
.wgb:hover .wgb-cta,.wgb:focus-visible .wgb-cta{color:var(--fg,#f0f0f3);border-color:var(--gold,#c9a96e)}
.wgb:hover .wgb-arr,.wgb:focus-visible .wgb-arr{transform:translateX(3px)}
.wgb:focus-visible{outline:1px solid var(--gold,#c9a96e);outline-offset:-3px}
@media(max-width:900px){
  .wgb-in{flex-direction:column;gap:3px;min-height:0;padding:7px 16px}
  .wgb-tag{font-size:8.5px;letter-spacing:.2em}
  .wgb-sep{display:none}
  .wgb-row{gap:12px}
  .wgb-text{font-size:12px;line-height:16px}
}
@media(max-width:520px){
  .wgb-long{display:none}
  .wgb-short{display:inline}
  .wgb-row{gap:10px}
  .wgb-cta{letter-spacing:.12em}
  /* The full initiative name may need two lines on the narrowest phones; the bar
     re-measures itself, so the nav and hero follow. */
  .wgb-tag{white-space:normal;text-align:center;justify-content:center}
}
@media(max-width:380px){.wgb-tag{letter-spacing:.14em}}
@media(prefers-reduced-motion:reduce){.wgb::after,.wgb-dot{animation:none}.wgb::after{opacity:0}}
`;

'use client';

import { useState, useEffect } from 'react';
import { getStoredUTM } from '@/lib/utm';
import { trackLeadEvent } from '@/lib/tracking-pixels';
import { TRANSLATIONS, Lang } from '@/lib/i18n-content';

interface StickyBarProps {
  lang?: Lang;
}

export default function StickyBar({ lang = 'es' }: StickyBarProps) {
  const t = TRANSLATIONS[lang].stickyBar;
  const tLc = TRANSLATIONS[lang].leadCapture;
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const utm = getStoredUTM();
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: email.split('@')[0], email, interest: interest || 'general', language: lang, ...utm }),
      });
      if (!res.ok && res.status !== 409) throw new Error('Failed');
      trackLeadEvent({ email, interest });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  if (dismissed || !visible) return null;

  return (
    <div className={`sticky-bar ${expanded ? 'sticky-bar-exp' : ''}`}>
      <div className="sticky-bar-inner">
        {status === 'success' ? (
          <div className="sb-row">
            <span className="sb-ok">&#10003; {t.success}</span>
            <button onClick={() => setDismissed(true)} className="sb-close" aria-label="Close">&times;</button>
          </div>
        ) : !expanded ? (
          <div className="sb-row">
            <div className="sb-text"><span className="sb-pulse" />{t.text}</div>
            <button onClick={() => setExpanded(true)} className="btn-primary sb-btn">{t.button}</button>
            <button onClick={() => setDismissed(true)} className="sb-close" aria-label="Close">&times;</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="sb-row">
            <input type="email" required placeholder={t.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} className="sb-input" />
            <select value={interest} onChange={(e) => setInterest(e.target.value)} className="sb-select">
              <option value="">{t.interestPlaceholder}</option>
              <option value="sofia_ai">{tLc.interestSofia}</option>
              <option value="cinema_engine">{tLc.interestCinema}</option>
              <option value="full_automation">{tLc.interestSuite}</option>
              <option value="custom">{tLc.interestCustom}</option>
            </select>
            <button type="submit" disabled={status === 'loading'} className="btn-primary sb-btn">{status === 'loading' ? '...' : t.send}</button>
            <button type="button" onClick={() => setExpanded(false)} className="sb-close" aria-label="Collapse">&darr;</button>
          </form>
        )}
      </div>
    </div>
  );
}

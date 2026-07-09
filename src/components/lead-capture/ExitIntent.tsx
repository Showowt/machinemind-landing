'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStoredUTM } from '@/lib/utm';
import { trackLeadEvent } from '@/lib/tracking-pixels';
import { TRANSLATIONS, Lang } from '@/lib/i18n-content';

interface ExitIntentProps {
  lang?: Lang;
}

export default function ExitIntent({ lang = 'es' }: ExitIntentProps) {
  const t = TRANSLATIONS[lang].exitIntent;
  const tLc = TRANSLATIONS[lang].leadCapture;
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [hasFired, setHasFired] = useState(false);

  const handleExitIntent = useCallback((e: MouseEvent) => {
    if (e.clientY <= 0 && !hasFired) {
      setHasFired(true);
      setShow(true);
    }
  }, [hasFired]);

  useEffect(() => {
    if (sessionStorage.getItem('mm_exit_dismissed')) return;
    const timeout = setTimeout(() => {
      document.addEventListener('mouseleave', handleExitIntent);
    }, 5000);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mouseleave', handleExitIntent);
    };
  }, [handleExitIntent]);

  const handleClose = () => {
    setShow(false);
    sessionStorage.setItem('mm_exit_dismissed', '1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const utm = getStoredUTM();
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: email.split('@')[0], email, interest: interest || 'exit_intent', language: lang, ...utm }),
      });
      trackLeadEvent({ email, interest: interest || 'exit_intent' });
      setStatus('success');
      setTimeout(handleClose, 3000);
    } catch {
      setStatus('loading');
    }
  };

  if (!show) return null;

  return (
    <div className="exit-overlay" onClick={handleClose}>
      <div className="exit-modal" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleClose} className="exit-close" aria-label="Close">&times;</button>
        {status === 'success' ? (
          <div className="exit-ok">
            <div className="exit-ok-icon">&#10003;</div>
            <h3>{t.successTitle}</h3>
            <p>{t.successText}</p>
          </div>
        ) : (
          <>
            <div className="exit-header">
              <span className="eyebrow">{t.eyebrow}</span>
              <h3>{t.title}</h3>
              <p>{t.subtitle}</p>
            </div>
            <form onSubmit={handleSubmit} className="exit-form">
              <input type="email" required placeholder={t.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" autoFocus />
              <select value={interest} onChange={(e) => setInterest(e.target.value)} className="form-input form-select">
                <option value="">{t.interest}</option>
                <option value="sofia_ai">{tLc.interestSofia}</option>
                <option value="cinema_engine">{tLc.interestCinema}</option>
                <option value="full_automation">{tLc.interestSuite}</option>
                <option value="custom">{tLc.interestCustom}</option>
              </select>
              <button type="submit" disabled={status === 'loading'} className="btn-primary lc-submit">
                {status === 'loading' ? tLc.sending : t.submit}
              </button>
            </form>
            <p className="exit-footer">{t.footer}</p>
          </>
        )}
      </div>
    </div>
  );
}

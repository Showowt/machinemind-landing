'use client';

import { useState, useEffect } from 'react';
import { getStoredUTM } from '@/lib/utm';
import { trackLeadEvent } from '@/lib/tracking-pixels';

export default function StickyBar() {
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
        body: JSON.stringify({ name: email.split('@')[0], email, interest: interest || 'general', ...utm }),
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
            <span className="sb-ok">&#10003; Got it! We&apos;ll be in touch within 2 hours.</span>
            <button onClick={() => setDismissed(true)} className="sb-close" aria-label="Close">&times;</button>
          </div>
        ) : !expanded ? (
          <div className="sb-row">
            <div className="sb-text"><span className="sb-pulse" />Losing revenue to missed inquiries?</div>
            <button onClick={() => setExpanded(true)} className="btn-primary sb-btn">Get a Free Quote</button>
            <button onClick={() => setDismissed(true)} className="sb-close" aria-label="Close">&times;</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="sb-row">
            <input type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="sb-input" />
            <select value={interest} onChange={(e) => setInterest(e.target.value)} className="sb-select">
              <option value="">Interest?</option>
              <option value="sofia_ai">Sofia AI</option>
              <option value="cinema_engine">Cinema Engine</option>
              <option value="full_automation">Full Automation</option>
              <option value="custom">Custom Project</option>
            </select>
            <button type="submit" disabled={status === 'loading'} className="btn-primary sb-btn">{status === 'loading' ? '...' : 'Send'}</button>
            <button type="button" onClick={() => setExpanded(false)} className="sb-close" aria-label="Collapse">&darr;</button>
          </form>
        )}
      </div>
    </div>
  );
}

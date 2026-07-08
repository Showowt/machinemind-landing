'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStoredUTM } from '@/lib/utm';
import { trackLeadEvent } from '@/lib/tracking-pixels';

export default function ExitIntent() {
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
        body: JSON.stringify({ name: email.split('@')[0], email, interest: interest || 'exit_intent', ...utm }),
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
            <h3>You&apos;re in.</h3>
            <p>We&apos;ll reach out within 2 hours with your custom strategy.</p>
          </div>
        ) : (
          <>
            <div className="exit-header">
              <span className="eyebrow">BEFORE YOU GO</span>
              <h3>Don&apos;t leave money<br />on the table.</h3>
              <p>Get a free revenue leak analysis — discover how much you&apos;re losing from missed inquiries.</p>
            </div>
            <form onSubmit={handleSubmit} className="exit-form">
              <input type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" autoFocus />
              <select value={interest} onChange={(e) => setInterest(e.target.value)} className="form-input form-select">
                <option value="">What interests you?</option>
                <option value="sofia_ai">Sofia AI — WhatsApp Automation</option>
                <option value="cinema_engine">Cinema Engine — Website</option>
                <option value="full_automation">Full Automation Suite</option>
                <option value="custom">Custom AI Project</option>
              </select>
              <button type="submit" disabled={status === 'loading'} className="btn-primary lc-submit">
                {status === 'loading' ? 'Sending...' : 'Get My Free Analysis'}
              </button>
            </form>
            <p className="exit-footer">100% free. No spam. Just your personalized revenue opportunity.</p>
          </>
        )}
      </div>
    </div>
  );
}

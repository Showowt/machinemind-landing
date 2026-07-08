'use client';

import { useState } from 'react';
import { getStoredUTM } from '@/lib/utm';
import { trackLeadEvent, trackContactEvent, trackWhatsAppClick } from '@/lib/tracking-pixels';

const INTEREST_OPTIONS = [
  { value: '', label: 'What are you interested in?' },
  { value: 'sofia_ai', label: 'Sofia AI — WhatsApp Automation' },
  { value: 'cinema_engine', label: 'Cinema Engine — Website' },
  { value: 'full_automation', label: 'Full Automation Suite' },
  { value: 'custom', label: 'Custom AI Project' },
];

const CAL_LINK = 'https://cal.com/machine-mind/machinemind-strategy-session';
const WHATSAPP_URL = 'https://wa.me/19544451638?text=Hi%2C%20I%27m%20interested%20in%20MachineMind';

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  interest: string;
  message: string;
}

export default function LeadCaptureForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '', email: '', phone: '', company: '', interest: '', message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const utm = getStoredUTM();
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, ...utm }),
      });
      if (!res.ok && res.status !== 409) throw new Error('Failed');
      trackLeadEvent({ email: formData.email, interest: formData.interest, source: utm.utm_source || undefined });
      setStatus('success');
      setFormData({ name: '', email: '', phone: '', company: '', interest: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="lc-success">
        <div className="lc-success-icon">&#10003;</div>
        <h3>We got you.</h3>
        <p>Expect a response within 2 hours. If you need us faster:</p>
        <div className="lc-success-actions">
          <a href={CAL_LINK} target="_blank" rel="noopener noreferrer" className="btn-primary" onClick={() => trackContactEvent()}>
            <span>Book Instant Call</span>
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lc-wa-btn" onClick={() => trackWhatsAppClick()}>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp Us
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="lc-form">
      <div className="lc-grid">
        <input type="text" name="name" required placeholder="Your name *" value={formData.name} onChange={handleChange} className="form-input" />
        <input type="email" name="email" required placeholder="Email *" value={formData.email} onChange={handleChange} className="form-input" />
        <input type="tel" name="phone" placeholder="Phone (optional)" value={formData.phone} onChange={handleChange} className="form-input" />
        <input type="text" name="company" placeholder="Company / Business" value={formData.company} onChange={handleChange} className="form-input" />
      </div>
      <select name="interest" value={formData.interest} onChange={handleChange} className="form-input form-select">
        {INTEREST_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <textarea name="message" placeholder="Tell us about your project (optional)" rows={3} value={formData.message} onChange={handleChange} className="form-input form-textarea" />
      {status === 'error' && <p className="form-error">Something went wrong. Try again or WhatsApp us directly.</p>}
      <button type="submit" disabled={status === 'loading'} className="btn-primary lc-submit">
        <span>{status === 'loading' ? 'Sending...' : 'Get Your Free Strategy Session'}</span>
        {status !== 'loading' && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        )}
      </button>
    </form>
  );
}

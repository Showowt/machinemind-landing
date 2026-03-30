'use client';

import { useState } from 'react';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  assetCategories: string[];
  estimatedEquity: string;
  decisionAuthority: string;
  objectives: string;
  timeframe: string;
}

export default function ViceroyAssessPage() {
  const [form, setForm] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    assetCategories: [],
    estimatedEquity: '',
    decisionAuthority: '',
    objectives: '',
    timeframe: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ quality: string; alignmentScore: number; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleCategory = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      assetCategories: prev.assetCategories.includes(cat)
        ? prev.assetCategories.filter((c) => c !== cat)
        : [...prev.assetCategories, cat],
    }));
  };

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.email) return;
    setLoading(true);

    try {
      const response = await fetch('/api/viceroy/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      setResult({
        quality: data.quality,
        alignmentScore: data.alignmentScore,
        message: data.message,
      });
      setSubmitted(true);
    } catch {
      setResult({
        quality: 'pending',
        alignmentScore: 0,
        message: 'Thank you for your submission. We will review and follow up.',
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f0f0f3',
    fontFamily: 'Satoshi,sans-serif',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.3s',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 10,
    letterSpacing: '0.3em',
    textTransform: 'uppercase' as const,
    color: 'rgba(240,240,243,0.4)',
    marginBottom: 8,
    fontFamily: 'Satoshi,sans-serif',
  };

  return (
    <>
      {/* Film Grain */}
      <svg style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', opacity: 0.03 }} width="100%" height="100%">
        <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#n)" />
      </svg>

      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none', boxShadow: 'inset 0 0 200px rgba(0,0,0,0.6)' }} />

      <div style={{ minHeight: '100vh', background: '#06060a' }}>
        {/* Nav */}
        <nav style={{
          padding: '24px clamp(24px,5vw,80px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <a href="/" style={{ fontFamily: 'Satoshi,sans-serif', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#f0f0f3', textDecoration: 'none', fontWeight: 700 }}>
            MACHINEMIND
          </a>
          <a href="/viceroy" style={{ fontFamily: 'Clash Display,sans-serif', fontSize: 14, color: '#c9a96e', letterSpacing: '0.2em', textTransform: 'uppercase', textDecoration: 'none' }}>
            VICEROY
          </a>
        </nav>

        {!submitted ? (
          <section style={{
            padding: 'clamp(40px,8vh,80px) clamp(24px,5vw,80px)',
            maxWidth: 640,
            margin: '0 auto',
          }}>
            <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 16 }}>
              60-SECOND ASSESSMENT
            </p>
            <h1 style={{
              fontFamily: 'Clash Display,sans-serif',
              fontSize: 'clamp(24px,4vw,36px)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.2,
              color: '#f0f0f3',
              marginBottom: 8,
            }}>
              Determine Structural Alignment
            </h1>
            <p style={{
              fontFamily: 'Satoshi,sans-serif',
              fontSize: 14,
              color: 'rgba(240,240,243,0.3)',
              lineHeight: 1.7,
              marginBottom: 40,
            }}>
              This assessment captures your objectives and asset situation to determine whether there is proper alignment with the private participation framework.
            </p>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    style={inputStyle}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    style={inputStyle}
                    placeholder="Last name"
                  />
                </div>
              </div>

              {/* Contact */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={labelStyle}>Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={inputStyle}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    style={inputStyle}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>

              {/* Asset Categories */}
              <div>
                <label style={labelStyle}>Asset Categories (Select all that apply)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
                  {[
                    { id: 'real_estate', label: 'Real Estate Equity ($200K+)' },
                    { id: 'cd_accounts', label: 'CD Accounts' },
                    { id: 'cash_reserves', label: 'Cash Reserves' },
                    { id: '401k', label: '401(k) Accounts' },
                    { id: 'sdira', label: 'Self-Directed IRA' },
                    { id: 'crypto', label: 'Crypto / Digital Assets' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      style={{
                        padding: '12px 16px',
                        background: form.assetCategories.includes(cat.id) ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                        border: form.assetCategories.includes(cat.id) ? '1px solid rgba(201,169,110,0.4)' : '1px solid rgba(255,255,255,0.1)',
                        color: form.assetCategories.includes(cat.id) ? '#c9a96e' : 'rgba(240,240,243,0.5)',
                        fontFamily: 'Satoshi,sans-serif',
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        textAlign: 'left',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estimated Equity */}
              <div>
                <label style={labelStyle}>Total Deployable Asset Value</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                  {[
                    { id: 'under_200k', label: 'Under $200K' },
                    { id: '200k_500k', label: '$200K — $500K' },
                    { id: '500k_1m', label: '$500K — $1M' },
                    { id: '1m_plus', label: '$1M+' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setForm({ ...form, estimatedEquity: opt.id })}
                      style={{
                        padding: '12px 16px',
                        background: form.estimatedEquity === opt.id ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                        border: form.estimatedEquity === opt.id ? '1px solid rgba(201,169,110,0.4)' : '1px solid rgba(255,255,255,0.1)',
                        color: form.estimatedEquity === opt.id ? '#c9a96e' : 'rgba(240,240,243,0.5)',
                        fontFamily: 'Satoshi,sans-serif',
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Decision Authority */}
              <div>
                <label style={labelStyle}>Decision Authority Over These Assets</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
                  {[
                    { id: 'sole', label: 'Sole decision maker' },
                    { id: 'primary', label: 'Primary, with spouse input' },
                    { id: 'shared', label: 'Shared decision making' },
                    { id: 'advised', label: 'Advisor-dependent' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setForm({ ...form, decisionAuthority: opt.id })}
                      style={{
                        padding: '12px 16px',
                        background: form.decisionAuthority === opt.id ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                        border: form.decisionAuthority === opt.id ? '1px solid rgba(201,169,110,0.4)' : '1px solid rgba(255,255,255,0.1)',
                        color: form.decisionAuthority === opt.id ? '#c9a96e' : 'rgba(240,240,243,0.5)',
                        fontFamily: 'Satoshi,sans-serif',
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        textAlign: 'left',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Objectives */}
              <div>
                <label style={labelStyle}>What would you like your assets to accomplish?</label>
                <textarea
                  value={form.objectives}
                  onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                  }}
                  placeholder="Describe what you're looking to achieve with your deployable assets..."
                />
              </div>

              {/* Timeframe */}
              <div>
                <label style={labelStyle}>Timeframe for Participation</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                  {[
                    { id: 'immediate', label: 'Ready now' },
                    { id: '30_days', label: 'Within 30 days' },
                    { id: '90_days', label: 'Within 90 days' },
                    { id: 'exploring', label: 'Exploring options' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setForm({ ...form, timeframe: opt.id })}
                      style={{
                        padding: '12px 16px',
                        background: form.timeframe === opt.id ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
                        border: form.timeframe === opt.id ? '1px solid rgba(201,169,110,0.4)' : '1px solid rgba(255,255,255,0.1)',
                        color: form.timeframe === opt.id ? '#c9a96e' : 'rgba(240,240,243,0.5)',
                        fontFamily: 'Satoshi,sans-serif',
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || !form.firstName || !form.lastName || !form.email}
                style={{
                  padding: '16px 36px',
                  border: '1px solid #c9a96e',
                  background: loading ? 'transparent' : 'rgba(201,169,110,0.1)',
                  color: '#f0f0f3',
                  fontFamily: 'Satoshi,sans-serif',
                  fontSize: 12,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'background 0.4s',
                  marginTop: 8,
                }}
              >
                {loading ? 'Evaluating Alignment...' : 'Submit Assessment'}
              </button>

              <p style={{ fontSize: 11, color: 'rgba(240,240,243,0.15)', lineHeight: 1.6 }}>
                This is not a securities offering. This assessment determines structural alignment for private contractual participation only.
                Your information is handled with strict confidentiality.
              </p>
            </div>
          </section>
        ) : (
          /* Success State */
          <section style={{
            padding: 'clamp(80px,12vh,160px) clamp(24px,5vw,80px)',
            maxWidth: 640,
            margin: '0 auto',
            textAlign: 'center',
          }}>
            <div style={{
              width: 64,
              height: 64,
              border: '2px solid #c9a96e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: 24,
              color: '#c9a96e',
            }}>
              &#10003;
            </div>
            <h2 style={{
              fontFamily: 'Clash Display,sans-serif',
              fontSize: 'clamp(24px,4vw,36px)',
              fontWeight: 500,
              color: '#f0f0f3',
              marginBottom: 16,
            }}>
              Assessment Received
            </h2>
            {result && (
              <>
                <p style={{
                  fontFamily: 'Satoshi,sans-serif',
                  fontSize: 15,
                  color: 'rgba(240,240,243,0.5)',
                  lineHeight: 1.7,
                  maxWidth: 480,
                  margin: '0 auto 24px',
                }}>
                  {result.message}
                </p>
                <div style={{
                  display: 'inline-flex',
                  gap: 24,
                  padding: '16px 32px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 12,
                  fontFamily: 'Satoshi,sans-serif',
                }}>
                  <span style={{ color: 'rgba(240,240,243,0.4)' }}>
                    Alignment: <span style={{ color: '#c9a96e' }}>{result.alignmentScore}/100</span>
                  </span>
                  <span style={{ color: 'rgba(240,240,243,0.4)' }}>
                    Status: <span style={{ color: '#c9a96e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{result.quality}</span>
                  </span>
                </div>
              </>
            )}
          </section>
        )}

        {/* Footer */}
        <footer style={{ padding: '40px clamp(24px,5vw,80px)', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <p style={{ fontSize: 10, color: 'rgba(240,240,243,0.2)' }}>
            Private contractual participation structure. Not a securities offering. Not financial advice.
          </p>
        </footer>
      </div>

      <style>{`
        html { background: #06060a; color: #f0f0f3; }
        body { margin: 0; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        ::selection { background: #c9a96e; color: #06060a; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: rgba(240,240,243,0.2); }
        input:focus, textarea:focus { border-color: rgba(201,169,110,0.4) !important; }
      `}</style>
    </>
  );
}

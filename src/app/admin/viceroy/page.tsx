'use client';

import { useState, useCallback, useEffect } from 'react';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  assetCategory: string[];
  estimatedEquity: string;
  source: string;
  city: string;
  state: string;
  propertyAddress?: string;
  linkedinUrl?: string;
  company?: string;
  title?: string;
  alignmentScore: number;
  enrichmentStatus: string;
  createdAt: string;
  notes: string;
}

interface ScrapeResult {
  leads: Lead[];
  meta: {
    total: number;
    enriched: number;
    partial: number;
    raw: number;
    aligned: number;
    probable: number;
    byCategory: Record<string, number>;
    generatedAt: string;
  };
}

interface EmailStats {
  stats: {
    total: number;
    byStep: Record<number, Record<string, number>>;
  };
  sequence: { step: number; subject: string; delayDays: number }[];
}

export default function ViceroyAdminPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<ScrapeResult['meta'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'businessOwners',
    'realEstate',
    'selfDirectedIRA',
  ]);
  const [selectedStates, setSelectedStates] = useState<string[]>([
    'FL', 'TX', 'CA', 'AZ', 'NV',
  ]);
  const [status, setStatus] = useState('');

  // Email campaign state
  const [activeTab, setActiveTab] = useState<'leads' | 'email'>('leads');
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');
  const [sendingStep, setSendingStep] = useState<number | null>(null);
  const [manualLeads, setManualLeads] = useState(''); // CSV: email,firstName,lastName
  const [emailMode, setEmailMode] = useState<'bulk' | 'manual'>('bulk');
  const [bulkLimit, setBulkLimit] = useState(50);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const toggleState = (st: string) => {
    setSelectedStates((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st],
    );
  };

  const runScrape = useCallback(async () => {
    setLoading(true);
    setStatus('Initiating lead scrape pipeline...');

    try {
      const response = await fetch('/api/viceroy/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-viceroy-key': apiKey,
        },
        body: JSON.stringify({
          categories: selectedCategories,
          states: selectedStates,
          enrich: true,
          maxPerCategory: 100,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setStatus(`Error: ${err.error || 'Failed'}`);
        return;
      }

      const data: ScrapeResult = await response.json();
      setLeads(data.leads);
      setMeta(data.meta);
      setStatus(`Complete: ${data.meta.total} leads found (${data.meta.enriched} enriched, ${data.meta.aligned} aligned)`);
    } catch (error) {
      setStatus(`Error: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [apiKey, selectedCategories, selectedStates]);

  const downloadCSV = useCallback(() => {
    if (leads.length === 0) return;

    const headers = [
      'First Name', 'Last Name', 'Email', 'Phone', 'Asset Categories',
      'Estimated Equity', 'Source', 'City', 'State', 'Property Address',
      'LinkedIn', 'Company', 'Title', 'Alignment Score', 'Status', 'Notes',
    ];

    const escape = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = leads.map((l) => [
      l.firstName, l.lastName, l.email, l.phone,
      l.assetCategory.join('; '), l.estimatedEquity, l.source,
      l.city, l.state, l.propertyAddress || '',
      l.linkedinUrl || '', l.company || '', l.title || '',
      l.alignmentScore.toString(), l.enrichmentStatus, l.notes,
    ].map(escape).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `viceroy-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [leads]);

  const loadEmailStats = useCallback(async () => {
    if (!apiKey) return;
    try {
      const res = await fetch('/api/viceroy/email', {
        headers: { 'x-viceroy-key': apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setEmailStats(data);
      }
    } catch {
      // ignore
    }
  }, [apiKey]);

  useEffect(() => {
    if (activeTab === 'email' && apiKey) {
      loadEmailStats();
    }
  }, [activeTab, apiKey, loadEmailStats]);

  const sendEmailStep = useCallback(async (step: number) => {
    if (!apiKey) {
      setEmailStatus('Enter your Viceroy API key first.');
      return;
    }

    setSendingStep(step);
    setEmailLoading(true);
    setEmailStatus(`Sending step ${step}...`);

    try {
      let body: Record<string, unknown>;

      if (emailMode === 'manual' && manualLeads.trim()) {
        // Parse manual CSV: email,firstName,lastName (one per line)
        const parsedLeads = manualLeads.trim().split('\n').map((line) => {
          const parts = line.split(',').map((p) => p.trim());
          return { email: parts[0], firstName: parts[1] || '', lastName: parts[2] || '' };
        }).filter((l) => l.email && l.email.includes('@'));

        body = { step, leads: parsedLeads };
      } else {
        // Bulk mode — pull from Supabase
        body = { step, limit: bulkLimit };
      }

      const res = await fetch('/api/viceroy/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-viceroy-key': apiKey,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setEmailStatus(`Error: ${data.error}`);
      } else {
        setEmailStatus(`✓ ${data.message}`);
        loadEmailStats();
      }
    } catch (err) {
      setEmailStatus(`Error: ${String(err)}`);
    } finally {
      setEmailLoading(false);
      setSendingStep(null);
    }
  }, [apiKey, emailMode, manualLeads, bulkLimit, loadEmailStats]);

  const allStates = ['FL', 'TX', 'CA', 'AZ', 'NV', 'CO', 'GA', 'NC', 'SC', 'TN', 'NY', 'NJ', 'PA', 'OH', 'IL', 'MI', 'VA', 'WA', 'OR', 'UT'];
  const allCategories = [
    { id: 'realEstate', label: 'Real Estate' },
    { id: 'selfDirectedIRA', label: 'Self-Directed IRA' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'businessOwners', label: 'Business Owners' },
    { id: 'highNetWorth', label: 'High Net Worth' },
  ];

  const btnStyle = (active: boolean) => ({
    padding: '8px 14px',
    background: active ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.03)',
    border: active ? '1px solid rgba(201,169,110,0.4)' : '1px solid rgba(255,255,255,0.1)',
    color: active ? '#c9a96e' : 'rgba(240,240,243,0.4)',
    fontFamily: 'Satoshi,sans-serif',
    fontSize: 11,
    cursor: 'pointer',
    transition: 'all 0.3s',
  });

  const sequenceSubjects = [
    'Your assets may qualify for a private participation structure',
    'What private contractual participation actually means',
    'Last note — Viceroy participation',
  ];

  const sequenceDelays = ['Send immediately', 'Send 3 days after step 1', 'Send 5 days after step 2'];

  return (
    <div style={{ minHeight: '100vh', background: '#06060a', padding: 'clamp(24px,4vw,60px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 8 }}>VICEROY COMMAND</p>
          <h1 style={{ fontFamily: 'Clash Display,sans-serif', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 500, color: '#f0f0f3' }}>
            Pipeline
          </h1>
        </div>
        <a href="/viceroy" style={{ fontSize: 11, color: 'rgba(240,240,243,0.3)', textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Back to Viceroy
        </a>
      </div>

      {/* API Key — shared across tabs */}
      <div style={{ marginBottom: 32, maxWidth: 360 }}>
        <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(240,240,243,0.4)', marginBottom: 8 }}>
          Viceroy API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter VICEROY_API_KEY"
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f0f0f3',
            fontFamily: 'Satoshi,sans-serif',
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 40, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['leads', 'email'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #c9a96e' : '2px solid transparent',
              color: activeTab === tab ? '#c9a96e' : 'rgba(240,240,243,0.3)',
              fontFamily: 'Satoshi,sans-serif',
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'all 0.3s',
            }}
          >
            {tab === 'leads' ? 'Lead Scraper' : 'Email Campaign'}
          </button>
        ))}
      </div>

      {/* ───────────────── TAB: LEADS ───────────────── */}
      {activeTab === 'leads' && (
        <>
          {/* Config */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(240,240,243,0.4)', marginBottom: 8 }}>
                Target Categories
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {allCategories.map((cat) => (
                  <button key={cat.id} onClick={() => toggleCategory(cat.id)} style={btnStyle(selectedCategories.includes(cat.id))}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(240,240,243,0.4)', marginBottom: 8 }}>
                Target States
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {allStates.map((st) => (
                  <button key={st} onClick={() => toggleState(st)} style={btnStyle(selectedStates.includes(st))}>
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <button
              onClick={runScrape}
              disabled={loading}
              style={{
                padding: '14px 32px',
                border: '1px solid #c9a96e',
                background: loading ? 'transparent' : 'rgba(201,169,110,0.1)',
                color: '#f0f0f3',
                fontFamily: 'Satoshi,sans-serif',
                fontSize: 12,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Scraping...' : 'Run Lead Scrape'}
            </button>

            {leads.length > 0 && (
              <button
                onClick={downloadCSV}
                style={{
                  padding: '14px 32px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: '#f0f0f3',
                  fontFamily: 'Satoshi,sans-serif',
                  fontSize: 12,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Download CSV ({leads.length} leads)
              </button>
            )}
          </div>

          {/* Status */}
          {status && (
            <div style={{
              padding: '12px 16px',
              background: status.includes('Error') ? 'rgba(255,0,0,0.1)' : 'rgba(201,169,110,0.05)',
              border: `1px solid ${status.includes('Error') ? 'rgba(255,0,0,0.2)' : 'rgba(201,169,110,0.15)'}`,
              marginBottom: 24,
              fontSize: 13,
              fontFamily: 'Satoshi,sans-serif',
              color: '#f0f0f3',
            }}>
              {status}
            </div>
          )}

          {/* Meta */}
          {meta && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 1, marginBottom: 32 }}>
              {[
                { label: 'Total', value: meta.total },
                { label: 'Enriched', value: meta.enriched },
                { label: 'Partial', value: meta.partial },
                { label: 'Raw', value: meta.raw },
                { label: 'Aligned', value: meta.aligned },
                { label: 'Probable', value: meta.probable },
              ].map((stat) => (
                <div key={stat.label} style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  textAlign: 'center',
                }}>
                  <p style={{ fontFamily: 'Clash Display,sans-serif', fontSize: 24, fontWeight: 600, color: '#f0f0f3' }}>{stat.value}</p>
                  <p style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(240,240,243,0.3)', marginTop: 4 }}>{stat.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Lead Table */}
          {leads.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Satoshi,sans-serif', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {['Score', 'Name', 'Email', 'Phone', 'Assets', 'Company/Title', 'State', 'Source', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '12px 8px', textAlign: 'left', color: '#c9a96e', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 8px', color: lead.alignmentScore >= 65 ? '#c9a96e' : lead.alignmentScore >= 40 ? '#f0f0f3' : 'rgba(240,240,243,0.4)' }}>
                        {lead.alignmentScore}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#f0f0f3' }}>
                        {lead.firstName} {lead.lastName}
                      </td>
                      <td style={{ padding: '10px 8px', color: lead.email ? '#f0f0f3' : 'rgba(240,240,243,0.2)' }}>
                        {lead.email || '—'}
                      </td>
                      <td style={{ padding: '10px 8px', color: lead.phone ? '#f0f0f3' : 'rgba(240,240,243,0.2)' }}>
                        {lead.phone || '—'}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'rgba(240,240,243,0.4)', fontSize: 11 }}>
                        {lead.assetCategory.join(', ')}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'rgba(240,240,243,0.4)', fontSize: 11 }}>
                        {lead.title ? `${lead.title}${lead.company ? ` @ ${lead.company}` : ''}` : lead.company || '—'}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'rgba(240,240,243,0.4)' }}>
                        {lead.state || '—'}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'rgba(240,240,243,0.3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {lead.source}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          padding: '3px 8px',
                          fontSize: 9,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          background: lead.enrichmentStatus === 'enriched' ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.05)',
                          color: lead.enrichmentStatus === 'enriched' ? '#c9a96e' : 'rgba(240,240,243,0.3)',
                          border: `1px solid ${lead.enrichmentStatus === 'enriched' ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        }}>
                          {lead.enrichmentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ───────────────── TAB: EMAIL CAMPAIGN ───────────────── */}
      {activeTab === 'email' && (
        <>
          {/* Stats */}
          {emailStats && (
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 9, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(240,240,243,0.3)', marginBottom: 16 }}>Campaign Stats</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1 }}>
                {[1, 2, 3].map((step) => {
                  const s = emailStats.stats.byStep[step] || {};
                  const total = Object.values(s).reduce((a, b) => a + b, 0);
                  return (
                    <div key={step} style={{ padding: '20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 12 }}>Step {step}</p>
                      <p style={{ fontFamily: 'Clash Display,sans-serif', fontSize: 28, fontWeight: 500, color: '#f0f0f3', marginBottom: 8 }}>{total}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {['sent', 'failed', 'opened', 'clicked', 'replied'].map((k) => (
                          s[k] ? <p key={k} style={{ fontSize: 11, color: 'rgba(240,240,243,0.4)' }}>
                            <span style={{ color: k === 'sent' ? '#f0f0f3' : k === 'replied' ? '#c9a96e' : 'rgba(240,240,243,0.5)' }}>{s[k]}</span>
                            {' '}{k}
                          </p> : null
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode toggle */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 9, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(240,240,243,0.3)', marginBottom: 12 }}>Send Mode</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEmailMode('bulk')} style={btnStyle(emailMode === 'bulk')}>Bulk (from Supabase)</button>
              <button onClick={() => setEmailMode('manual')} style={btnStyle(emailMode === 'manual')}>Manual (paste CSV)</button>
            </div>
          </div>

          {emailMode === 'bulk' && (
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(240,240,243,0.4)', marginBottom: 8 }}>
                  Max Leads Per Send
                </label>
                <input
                  type="number"
                  value={bulkLimit}
                  onChange={(e) => setBulkLimit(Number(e.target.value))}
                  min={1}
                  max={500}
                  style={{
                    width: 120,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f0f0f3',
                    fontFamily: 'Satoshi,sans-serif',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'rgba(240,240,243,0.3)', maxWidth: 400, lineHeight: 1.6 }}>
                Pulls qualified leads from Supabase ordered by alignment score. Automatically skips leads who already received each step.
              </p>
            </div>
          )}

          {emailMode === 'manual' && (
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(240,240,243,0.4)', marginBottom: 8 }}>
                Lead List (email, firstName, lastName — one per line)
              </label>
              <textarea
                value={manualLeads}
                onChange={(e) => setManualLeads(e.target.value)}
                rows={8}
                placeholder={'john@example.com, John, Smith\njane@company.com, Jane, Doe'}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f0f0f3',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
              <p style={{ fontSize: 11, color: 'rgba(240,240,243,0.2)', marginTop: 8 }}>
                {manualLeads.trim() ? `${manualLeads.trim().split('\n').filter(l => l.includes('@')).length} valid emails detected` : 'Paste one lead per line'}
              </p>
            </div>
          )}

          {/* Sequence steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 32 }}>
            {[1, 2, 3].map((step) => (
              <div key={step} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                padding: '20px 24px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ width: 32, height: 32, border: '1px solid rgba(201,169,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Clash Display,sans-serif', fontSize: 14, color: '#c9a96e' }}>{step}</span>
                </div>

                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'Satoshi,sans-serif', fontSize: 13, color: '#f0f0f3', marginBottom: 4 }}>
                    {sequenceSubjects[step - 1]}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(240,240,243,0.3)' }}>{sequenceDelays[step - 1]}</p>
                </div>

                <button
                  onClick={() => sendEmailStep(step)}
                  disabled={emailLoading}
                  style={{
                    padding: '10px 24px',
                    border: '1px solid #c9a96e',
                    background: sendingStep === step ? 'rgba(201,169,110,0.2)' : 'transparent',
                    color: '#c9a96e',
                    fontFamily: 'Satoshi,sans-serif',
                    fontSize: 11,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    cursor: emailLoading ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.3s',
                  }}
                >
                  {sendingStep === step ? 'Sending...' : `Send Step ${step}`}
                </button>
              </div>
            ))}
          </div>

          {/* Email status */}
          {emailStatus && (
            <div style={{
              padding: '14px 20px',
              background: emailStatus.includes('Error') ? 'rgba(255,0,0,0.08)' : 'rgba(201,169,110,0.06)',
              border: `1px solid ${emailStatus.includes('Error') ? 'rgba(255,0,0,0.2)' : 'rgba(201,169,110,0.2)'}`,
              fontFamily: 'Satoshi,sans-serif',
              fontSize: 13,
              color: emailStatus.includes('Error') ? '#ff6b6b' : '#f0f0f3',
              lineHeight: 1.6,
            }}>
              {emailStatus}
            </div>
          )}

          <div style={{ marginTop: 40, padding: '16px 20px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 11, color: 'rgba(240,240,243,0.2)', lineHeight: 1.8 }}>
              Emails send from <strong style={{ color: 'rgba(240,240,243,0.4)' }}>viceroy@machinemindconsulting.com</strong> via Resend.<br />
              Requires: <code style={{ color: '#c9a96e', fontSize: 10 }}>RESEND_API_KEY</code>, <code style={{ color: '#c9a96e', fontSize: 10 }}>VICEROY_API_KEY</code> in environment.<br />
              Step 2 sends only to leads who received step 1. Step 3 sends only to leads who received step 2.
            </p>
          </div>
        </>
      )}

      <style>{`
        html { background: #06060a; color: #f0f0f3; }
        body { margin: 0; -webkit-font-smoothing: antialiased; }
        ::selection { background: #c9a96e; color: #06060a; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: rgba(240,240,243,0.2); }
        input:focus, textarea:focus { border-color: rgba(201,169,110,0.4) !important; }
      `}</style>
    </div>
  );
}

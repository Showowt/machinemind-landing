'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ApiResponse {
  message: string;
  sessionId: string;
  alignmentScore: number;
  quality: string;
  gate: number;
  recommendation: string;
  investorModel: string;
  investorModelConfidence: number;
}

export default function ViceroyPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [alignmentData, setAlignmentData] = useState<{
    score: number;
    quality: string;
    model: string;
  } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch('/api/viceroy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          sessionId,
        }),
      });

      const data: ApiResponse = await response.json();

      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
      setSessionId(data.sessionId);
      setAlignmentData({
        score: data.alignmentScore,
        quality: data.quality,
        model: data.investorModel,
      });
    } catch {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'I appreciate your interest. What type of assets are you currently working with — real estate equity, cash reserves, retirement accounts, or something else?',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Film Grain */}
      <svg style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', opacity: 0.03 }} width="100%" height="100%">
        <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#n)" />
      </svg>

      {/* Vignette */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none', boxShadow: 'inset 0 0 200px rgba(0,0,0,0.6)' }} />

      <div style={{ minHeight: '100vh', background: '#06060a', display: 'flex', flexDirection: 'column' }}>
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
          <span style={{ fontFamily: 'Clash Display,sans-serif', fontSize: 14, color: '#c9a96e', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            VICEROY
          </span>
        </nav>

        {/* Hero */}
        <section style={{
          padding: 'clamp(40px,8vh,80px) clamp(24px,5vw,80px)',
          maxWidth: 800,
          margin: '0 auto',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 16 }}>
            PRIVATE CAPITAL PARTICIPATION
          </p>
          <h1 style={{
            fontFamily: 'Clash Display,sans-serif',
            fontSize: 'clamp(28px,5vw,48px)',
            fontWeight: 500,
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            color: '#f0f0f3',
            margin: '0 0 16px 0',
          }}>
            Structured Participation for{' '}
            <em style={{ fontFamily: 'Instrument Serif,serif', fontStyle: 'italic', color: '#c9a96e' }}>
              Decisive
            </em>{' '}
            Capital
          </h1>
          <p style={{
            fontFamily: 'Satoshi,sans-serif',
            fontSize: 15,
            color: 'rgba(240,240,243,0.3)',
            maxWidth: 560,
            margin: '0 auto 32px',
            lineHeight: 1.7,
          }}>
            Private contractual arrangements tied to demonstrated operational performance.
            Not securities. Not speculation. Structural participation for individuals
            who control deployable assets directly.
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/viceroy/assess" style={{
              display: 'inline-block',
              padding: '14px 36px',
              border: '1px solid #c9a96e',
              background: 'transparent',
              color: '#f0f0f3',
              fontFamily: 'Satoshi,sans-serif',
              fontSize: 11,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              transition: 'background 0.4s, color 0.4s',
            }}>
              60-Second Assessment
            </a>
          </div>
        </section>

        {/* Asset Categories */}
        <section style={{
          padding: '0 clamp(24px,5vw,80px) clamp(40px,6vh,60px)',
          maxWidth: 900,
          margin: '0 auto',
          width: '100%',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 1 }}>
            {[
              { label: 'Real Estate Equity', sub: '$200K+' },
              { label: 'CD Accounts', sub: 'Direct' },
              { label: 'Cash Reserves', sub: 'Deployable' },
              { label: '401(k)', sub: 'Repositionable' },
              { label: 'Self-Directed IRA', sub: 'Self-Managed' },
              { label: 'Crypto', sub: 'Digital Assets' },
            ].map((a) => (
              <div key={a.label} style={{
                padding: '20px 16px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                textAlign: 'center',
              }}>
                <p style={{ fontFamily: 'Satoshi,sans-serif', fontSize: 12, color: '#f0f0f3', marginBottom: 4 }}>{a.label}</p>
                <p style={{ fontSize: 10, color: '#c9a96e', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{a.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Chat Interface */}
        <section style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 800,
          margin: '0 auto',
          width: '100%',
          padding: '0 clamp(24px,5vw,80px) 40px',
        }}>
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 32,
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 8 }}>
              QUALIFICATION CONVERSATION
            </p>
            <p style={{ fontSize: 13, color: 'rgba(240,240,243,0.3)', lineHeight: 1.6 }}>
              Describe your asset situation and objectives. This conversation determines structural alignment.
            </p>
          </div>

          {/* Alignment indicator */}
          {alignmentData && (
            <div style={{
              display: 'flex',
              gap: 24,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 16,
              fontSize: 11,
              fontFamily: 'Satoshi,sans-serif',
            }}>
              <span style={{ color: 'rgba(240,240,243,0.4)' }}>
                Alignment: <span style={{ color: alignmentData.score >= 65 ? '#c9a96e' : alignmentData.score >= 40 ? '#f0f0f3' : 'rgba(240,240,243,0.4)' }}>
                  {alignmentData.score}/100
                </span>
              </span>
              <span style={{ color: 'rgba(240,240,243,0.4)' }}>
                Status: <span style={{ color: '#c9a96e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{alignmentData.quality}</span>
              </span>
              <span style={{ color: 'rgba(240,240,243,0.4)' }}>
                Profile: <span style={{ color: '#f0f0f3', textTransform: 'capitalize' }}>{alignmentData.model}</span>
              </span>
            </div>
          )}

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 200,
            maxHeight: 'calc(100vh - 600px)',
            marginBottom: 16,
          }}>
            {messages.length === 0 && (
              <div style={{
                padding: 24,
                background: 'rgba(201,169,110,0.05)',
                border: '1px solid rgba(201,169,110,0.15)',
              }}>
                <p style={{ fontFamily: 'Satoshi,sans-serif', fontSize: 14, color: '#f0f0f3', lineHeight: 1.7 }}>
                  Welcome. I&apos;m here to determine whether there&apos;s structural alignment between your current asset situation and our private participation framework.
                </p>
                <p style={{ fontFamily: 'Satoshi,sans-serif', fontSize: 14, color: 'rgba(240,240,243,0.4)', lineHeight: 1.7, marginTop: 12 }}>
                  To begin — what type of assets are you currently managing, and what would you like them to accomplish?
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  padding: '16px 20px',
                  background: msg.role === 'user' ? 'rgba(255,255,255,0.04)' : 'rgba(201,169,110,0.05)',
                  borderLeft: msg.role === 'assistant' ? '2px solid rgba(201,169,110,0.3)' : '2px solid rgba(255,255,255,0.1)',
                }}
              >
                <p style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: msg.role === 'user' ? 'rgba(240,240,243,0.3)' : '#c9a96e', marginBottom: 8 }}>
                  {msg.role === 'user' ? 'YOU' : 'VICEROY'}
                </p>
                <p style={{ fontFamily: 'Satoshi,sans-serif', fontSize: 14, color: '#f0f0f3', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </p>
              </div>
            ))}

            {loading && (
              <div style={{ padding: '16px 20px', borderLeft: '2px solid rgba(201,169,110,0.3)' }}>
                <p style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: 8 }}>VICEROY</p>
                <p style={{ color: 'rgba(240,240,243,0.3)', fontSize: 14 }}>Evaluating alignment...</p>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Describe your asset situation and objectives..."
              style={{
                flex: 1,
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.02)',
                border: 'none',
                color: '#f0f0f3',
                fontFamily: 'Satoshi,sans-serif',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                padding: '16px 24px',
                background: loading ? 'transparent' : 'rgba(201,169,110,0.1)',
                border: 'none',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                color: '#c9a96e',
                fontFamily: 'Satoshi,sans-serif',
                fontSize: 11,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'background 0.3s',
              }}
            >
              {loading ? '...' : 'SEND'}
            </button>
          </div>
        </section>

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
        input::placeholder { color: rgba(240,240,243,0.2); }
      `}</style>
    </>
  );
}

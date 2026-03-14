"use client";

export default function NeuralSVGSection() {
  return (
    <section style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      padding: 'clamp(60px, 10vh, 120px) clamp(24px, 5vw, 80px)',
      background: '#06060a'
    }}>
      <div style={{ width: '100%', maxWidth: '1000px' }}>
        {/* Section label */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '9px', letterSpacing: '0.5em', textTransform: 'uppercase', color: '#c9a96e', marginBottom: '16px' }}>
            The Network
          </div>
          <p style={{ fontFamily: "var(--font-serif-display, 'Instrument Serif', serif)", fontSize: 'clamp(20px, 2.5vw, 32px)', fontStyle: 'italic', color: 'rgba(240,240,243,0.5)', lineHeight: 1.5, maxWidth: '600px', margin: '0 auto' }} data-text="scroll-fade">
            Every connection is intentional. Every node, a decision point.
          </p>
        </div>

        <svg data-svg-draw viewBox="0 0 900 300" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
          {/* Neural network nodes */}
          <circle cx="100" cy="150" r="10" stroke="#c9a96e" strokeWidth="1.5" fill="rgba(201,169,110,0.08)"/>
          <circle cx="250" cy="80" r="10" stroke="#c9a96e" strokeWidth="1.5" fill="rgba(201,169,110,0.08)"/>
          <circle cx="250" cy="220" r="10" stroke="#c9a96e" strokeWidth="1.5" fill="rgba(201,169,110,0.08)"/>
          <circle cx="450" cy="60" r="10" stroke="#c9a96e" strokeWidth="1.5" fill="rgba(201,169,110,0.08)"/>
          <circle cx="450" cy="150" r="14" stroke="#c9a96e" strokeWidth="2" fill="rgba(201,169,110,0.12)"/>
          <circle cx="450" cy="240" r="10" stroke="#c9a96e" strokeWidth="1.5" fill="rgba(201,169,110,0.08)"/>
          <circle cx="650" cy="80" r="10" stroke="#c9a96e" strokeWidth="1.5" fill="rgba(201,169,110,0.08)"/>
          <circle cx="650" cy="220" r="10" stroke="#c9a96e" strokeWidth="1.5" fill="rgba(201,169,110,0.08)"/>
          <circle cx="800" cy="150" r="10" stroke="#c9a96e" strokeWidth="1.5" fill="rgba(201,169,110,0.08)"/>
          {/* Connections */}
          <line x1="108" y1="150" x2="242" y2="80" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="108" y1="150" x2="242" y2="220" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="258" y1="80" x2="442" y2="60" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="258" y1="80" x2="442" y2="150" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="258" y1="220" x2="442" y2="150" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="258" y1="220" x2="442" y2="240" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="458" y1="60" x2="642" y2="80" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="460" y1="150" x2="642" y2="80" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="460" y1="150" x2="642" y2="220" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="458" y1="240" x2="642" y2="220" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="658" y1="80" x2="792" y2="150" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          <line x1="658" y1="220" x2="792" y2="150" stroke="#c9a96e" strokeWidth="1.5" strokeOpacity="0.6"/>
          {/* Decorative arcs in cyan */}
          <path d="M 100 150 Q 175 50 250 80" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.4" fill="none"/>
          <path d="M 450 150 Q 550 50 650 80" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.4" fill="none"/>
          <path d="M 450 150 Q 550 250 650 220" stroke="#00e5ff" strokeWidth="1" strokeOpacity="0.4" fill="none"/>
          {/* Node labels */}
          <text x="100" y="180" textAnchor="middle" fontSize="11" fill="rgba(201,169,110,0.8)" fontFamily="monospace" letterSpacing="2">INPUT</text>
          <text x="450" y="180" textAnchor="middle" fontSize="11" fill="#c9a96e" fontFamily="monospace" letterSpacing="2">SOFIA</text>
          <text x="800" y="180" textAnchor="middle" fontSize="11" fill="rgba(201,169,110,0.8)" fontFamily="monospace" letterSpacing="2">OUTPUT</text>
        </svg>
      </div>
    </section>
  );
}

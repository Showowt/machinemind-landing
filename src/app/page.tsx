'use client';
import { useEffect, useRef } from 'react';

export default function Home() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll progress bar
    const onScroll = () => {
      if (!progressRef.current) return;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current.style.width = ((window.scrollY / h) * 100) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // GSAP scroll animations
    const loadGSAP = async () => {
      const gsap = (await import('gsap')).default;
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      document.querySelectorAll('[data-animate]').forEach(el => {
        gsap.from(el, {
          y: 40, opacity: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true }
        });
      });

      document.querySelectorAll('[data-stagger]').forEach(container => {
        gsap.from(container.children, {
          y: 40, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: container, start: 'top 85%', once: true }
        });
      });
    };
    loadGSAP();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* Progress Bar */}
      <div ref={progressRef} style={{ position:'fixed',top:0,left:0,height:2,zIndex:9995,background:'linear-gradient(90deg,#c9a96e,#00e5ff)',width:'0%' }} />

      {/* Film Grain */}
      <svg style={{ position:'fixed',inset:0,zIndex:9999,pointerEvents:'none',opacity:0.03 }} width="100%" height="100%">
        <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/></filter>
        <rect width="100%" height="100%" filter="url(#n)"/>
      </svg>

      {/* Vignette */}
      <div style={{ position:'fixed',inset:0,zIndex:9998,pointerEvents:'none',boxShadow:'inset 0 0 200px rgba(0,0,0,0.6)' }} />

      {/* Nav */}
      <nav style={{ position:'fixed',top:0,left:0,right:0,zIndex:100,padding:'24px clamp(24px,5vw,80px)',display:'flex',justifyContent:'space-between',alignItems:'center',mixBlendMode:'difference' }}>
        <a href="/" style={{ fontFamily:'Satoshi,sans-serif',fontSize:11,letterSpacing:'0.3em',textTransform:'uppercase',color:'#f0f0f3',textDecoration:'none',fontWeight:700 }}>MACHINEMIND</a>
        <div style={{ display:'flex',gap:32 }}>
          {['Work','About','Contact'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize:11,letterSpacing:'0.12em',textTransform:'uppercase',color:'#f0f0f3',textDecoration:'none',opacity:0.4,transition:'opacity 0.4s' }}
              onMouseEnter={e=>(e.target as HTMLElement).style.opacity='1'}
              onMouseLeave={e=>(e.target as HTMLElement).style.opacity='0.4'}
            >{l}</a>
          ))}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight:'100vh',display:'flex',flexDirection:'column',justifyContent:'center',padding:'0 clamp(24px,5vw,80px)',background:'#06060a' }}>
        <div data-animate>
          <p style={{ fontSize:9,letterSpacing:'0.5em',textTransform:'uppercase',color:'#c9a96e',marginBottom:16,fontFamily:'Satoshi,sans-serif' }}>AI AUTOMATION CONSULTANCY</p>
          <h1 style={{ fontFamily:'Clash Display,sans-serif',fontSize:'clamp(40px,7vw,96px)',fontWeight:500,letterSpacing:'-0.05em',lineHeight:1.1,color:'#f0f0f3',margin:0 }}>
            We Build AI Systems<br/>That <em style={{ fontFamily:'Instrument Serif,serif',fontStyle:'italic',color:'#c9a96e' }}>Think</em>
          </h1>
          <p style={{ fontFamily:'Satoshi,sans-serif',fontSize:16,color:'rgba(240,240,243,0.3)',maxWidth:500,marginTop:20,lineHeight:1.7 }}>
            Automation infrastructure for hospitality, real estate, and private capital.
          </p>
          <a href="#contact" style={{ display:'inline-block',marginTop:32,padding:'14px 36px',border:'1px solid #c9a96e',background:'transparent',color:'#f0f0f3',fontFamily:'Satoshi,sans-serif',fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',textDecoration:'none',position:'relative',overflow:'hidden',transition:'color 0.5s cubic-bezier(0.23,1,0.32,1)' }}>
            <span style={{ position:'relative',zIndex:1 }}>Start a Project</span>
          </a>
        </div>
        <div style={{ position:'absolute',bottom:40,left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:8 }}>
          <div style={{ width:1,height:48,background:'linear-gradient(to bottom,#c9a96e,transparent)',animation:'scrollPulse 2s ease-in-out infinite' }}/>
          <span style={{ fontSize:9,letterSpacing:'0.3em',textTransform:'uppercase',color:'rgba(240,240,243,0.3)' }}>Scroll</span>
        </div>
      </section>

      {/* Capabilities */}
      <section id="work" style={{ padding:'clamp(80px,12vh,160px) clamp(24px,5vw,80px)',maxWidth:1200,margin:'0 auto' }}>
        <p data-animate style={{ fontSize:9,letterSpacing:'0.5em',textTransform:'uppercase',color:'#c9a96e',marginBottom:16 }}>WHAT WE BUILD</p>
        <h2 data-animate style={{ fontFamily:'Clash Display,sans-serif',fontSize:'clamp(32px,5vw,48px)',fontWeight:500,letterSpacing:'-0.03em',color:'#f0f0f3',marginBottom:48,lineHeight:1.1 }}>
          Three Systems. Infinite Leverage.
        </h2>
        <div data-stagger style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:1 }}>
          {[
            { label:'01', title:'Sofia AI', desc:'24/7 WhatsApp concierge that qualifies leads, handles reservations, and closes while you sleep.' },
            { label:'02', title:'Cinema Engine', desc:'Websites that feel like films. 25 layers of scroll-driven animation, 3D, and behavioral design.' },
            { label:'03', title:'Viceroy', desc:'AI-powered investor qualification. Detects psychology, scores across 8 dimensions, routes to humans.' },
          ].map(c => (
            <div key={c.title} style={{ padding:32,background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.06)',position:'relative',transition:'background 0.4s' }}>
              <p style={{ fontSize:9,letterSpacing:'0.4em',textTransform:'uppercase',color:'#c9a96e',marginBottom:12 }}>{c.label}</p>
              <h3 style={{ fontFamily:'Clash Display,sans-serif',fontSize:20,fontWeight:500,color:'#f0f0f3',marginBottom:8 }}>{c.title}</h3>
              <p style={{ fontSize:14,color:'rgba(240,240,243,0.3)',lineHeight:1.7 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Manifesto */}
      <section style={{ padding:'clamp(80px,12vh,160px) clamp(24px,5vw,80px)',maxWidth:800,margin:'0 auto',textAlign:'center' }}>
        <p data-animate style={{ fontFamily:'Clash Display,sans-serif',fontSize:'clamp(24px,3.5vw,40px)',fontWeight:400,lineHeight:1.4,color:'#f0f0f3' }}>
          We don&apos;t build websites. We build systems that <em style={{ fontFamily:'Instrument Serif,serif',fontStyle:'italic',color:'#c9a96e' }}>breathe</em>, that <em style={{ fontFamily:'Instrument Serif,serif',fontStyle:'italic',color:'#c9a96e' }}>learn</em>, that <em style={{ fontFamily:'Instrument Serif,serif',fontStyle:'italic',color:'#c9a96e' }}>evolve</em>. Every pixel has purpose. Every interaction is choreographed. We create what doesn&apos;t exist yet.
        </p>
      </section>

      {/* Stats */}
      <section style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',borderTop:'1px solid rgba(255,255,255,0.06)',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        {[
          { num:'47+', label:'Deployments' },
          { num:'3', label:'Revenue Streams' },
          { num:'24/7', label:'Sofia Active' },
          { num:'90%', label:'Gross Margins' },
        ].map((s,i) => (
          <div key={i} data-animate style={{ padding:32,textAlign:'center',borderRight:'1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontFamily:'Clash Display,sans-serif',fontSize:'clamp(28px,4vw,48px)',fontWeight:600,color:'#f0f0f3',letterSpacing:'-0.02em' }}>{s.num}</p>
            <p style={{ fontSize:9,letterSpacing:'0.4em',textTransform:'uppercase',color:'rgba(240,240,243,0.3)',marginTop:8 }}>{s.label}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section id="contact" style={{ padding:'clamp(120px,15vh,200px) clamp(24px,5vw,80px)',textAlign:'center' }}>
        <h2 data-animate style={{ fontFamily:'Clash Display,sans-serif',fontSize:'clamp(28px,4vw,48px)',fontWeight:500,color:'#f0f0f3',letterSpacing:'-0.03em',marginBottom:32 }}>
          Ready to build something that doesn&apos;t exist yet?
        </h2>
        <a data-animate href="https://cal.com" style={{ display:'inline-block',padding:'14px 36px',border:'1px solid #c9a96e',background:'transparent',color:'#f0f0f3',fontFamily:'Satoshi,sans-serif',fontSize:11,letterSpacing:'0.15em',textTransform:'uppercase',textDecoration:'none' }}>
          <span style={{ position:'relative',zIndex:1 }}>Book a Call</span>
        </a>
        <p data-animate style={{ fontSize:12,color:'rgba(240,240,243,0.3)',marginTop:16 }}>
          or email machinemindconsulting@gmail.com
        </p>
      </section>

      {/* Footer */}
      <footer style={{ padding:'80px clamp(24px,5vw,80px) 40px',borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontFamily:'Satoshi,sans-serif',fontSize:11,letterSpacing:'0.3em',textTransform:'uppercase',color:'#c9a96e',marginBottom:16 }}>MACHINEMIND</p>
        <p style={{ fontSize:11,color:'rgba(240,240,243,0.3)' }}>© 2026 MachineMind Consulting · Cartagena, Colombia</p>
      </footer>

      <style>{`
        @keyframes scrollPulse { 0%,100%{opacity:0.3;transform:scaleY(0.6)} 50%{opacity:1;transform:scaleY(1)} }
        html{background:#06060a;color:#f0f0f3}
        body{margin:0;overflow-x:hidden;-webkit-font-smoothing:antialiased}
        ::selection{background:#c9a96e;color:#06060a}
        *{margin:0;padding:0;box-sizing:border-box}
      `}</style>
    </>
  );
}

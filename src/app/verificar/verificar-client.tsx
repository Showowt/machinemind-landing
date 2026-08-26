'use client';

import { useEffect } from 'react';

/*
 * /verificar — the official verification page.
 * Purpose: when a business owner suspects our outreach is a scam, this page is
 * the 10-second self-check. Every official WhatsApp number, the anti-scam
 * pledge, verifiable work, and real contact channels. Linked from WhatsApp
 * profiles, the pre-call heads-up, and Sofia's trust responses.
 */

const OFFICIAL_NUMBERS: { number: string; display: string; label: string }[] = [
  { number: '17869472533', display: '+1 (786) 947-2533', label: 'El Salvador · principal' },
  { number: '17867888196', display: '+1 (786) 788-8196', label: 'El Salvador' },
  { number: '15559243163', display: '+1 (555) 924-3163', label: 'El Salvador' },
  { number: '15559232954', display: '+1 (555) 923-2954', label: 'El Salvador' },
  { number: '17866500003', display: '+1 (786) 650-0003', label: 'El Salvador' },
  { number: '19543889003', display: '+1 (954) 388-9003', label: 'Panamá · principal' },
  { number: '17724096432', display: '+1 (772) 409-6432', label: 'Panamá' },
  { number: '15612904501', display: '+1 (561) 290-4501', label: 'Colombia' },
  { number: '17869813902', display: '+1 (786) 981-3902', label: 'Perú · Costa Rica · Ecuador' },
];

const PLEDGE: { title: string; body: string }[] = [
  {
    title: 'Nunca pedimos dinero por adelantado',
    body: 'Primero ves una demo construida para tu negocio, gratis y sin compromiso. El dinero solo se conversa cuando vos ya viste el sistema funcionando.',
  },
  {
    title: 'Nunca pedimos transferencias personales ni remesas',
    body: 'Todo pago va por checkout formal a nombre de MachineMind, con precio por escrito. Si alguien pide una transferencia a una cuenta personal usando nuestro nombre, es una estafa — reportánosla.',
  },
  {
    title: 'Nunca pedimos códigos de verificación ni contraseñas',
    body: 'Jamás te vamos a pedir un código que te llegue por SMS o WhatsApp, ni claves de ninguna cuenta. Nadie legítimo pide eso.',
  },
  {
    title: 'Siempre podés verificar antes de responder',
    body: 'Compará el número que te escribió con la lista de esta página. Revisá que el perfil de WhatsApp diga MachineMind con nuestro logo. Ante cualquier duda, escribinos por los canales de abajo.',
  },
];

const WORK: { name: string; where: string; url: string }[] = [
  { name: 'Piel Dorada', where: 'El Salvador', url: 'https://pieldoradasv.com' },
  { name: 'AMO Cartagena', where: 'Colombia', url: 'https://amocartagena.co' },
  { name: 'Ballantir', where: 'Plataforma deportiva', url: 'https://ballantir.com' },
];

export default function VerificarClient() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add('mmv-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll('.mmv-reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="mmv-page">
      <style>{`
        .mmv-page { min-height: 100vh; background: #06060a; color: #f0f0f3; font-family: var(--font-satoshi, 'Satoshi', sans-serif); padding: 0 24px 120px; }
        .mmv-wrap { max-width: 880px; margin: 0 auto; }
        .mmv-nav { display: flex; justify-content: space-between; align-items: center; padding: 32px 0; }
        .mmv-logo { font-family: var(--font-clash, 'Clash Display', sans-serif); font-weight: 600; letter-spacing: 0.18em; font-size: 14px; color: #f0f0f3; text-decoration: none; }
        .mmv-logo span { color: #1e9bf0; }
        .mmv-eyebrow { font-size: 11px; letter-spacing: 0.32em; color: #1e9bf0; text-transform: uppercase; margin: 72px 0 20px; }
        .mmv-h1 { font-family: var(--font-clash, 'Clash Display', sans-serif); font-size: clamp(34px, 6vw, 58px); line-height: 1.05; font-weight: 600; margin: 0 0 24px; }
        .mmv-h1 em { font-family: var(--font-instrument, 'Instrument Serif', serif); font-style: italic; font-weight: 400; color: #1e9bf0; }
        .mmv-lede { font-size: 17px; line-height: 1.7; color: rgba(240,240,243,0.55); max-width: 620px; margin-bottom: 8px; }
        .mmv-sec { margin-top: 88px; }
        .mmv-sec-title { font-family: var(--font-clash, 'Clash Display', sans-serif); font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase; color: #1e9bf0; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 14px; margin-bottom: 28px; }
        .mmv-numbers { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.06); }
        .mmv-num { background: #08080d; padding: 20px 22px; transition: background 0.3s; }
        .mmv-num:hover { background: rgba(30,155,240,0.06); }
        .mmv-num-tel { font-family: var(--font-clash, 'Clash Display', sans-serif); font-size: 18px; letter-spacing: 0.02em; color: #f0f0f3; }
        .mmv-num-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(240,240,243,0.3); margin-top: 6px; }
        .mmv-note { font-size: 14px; line-height: 1.7; color: rgba(240,240,243,0.45); margin-top: 22px; max-width: 640px; }
        .mmv-note strong { color: #f0f0f3; font-weight: 500; }
        .mmv-pledge { display: flex; flex-direction: column; gap: 1px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.06); }
        .mmv-pledge-item { background: #08080d; padding: 26px 28px; border-left: 2px solid transparent; transition: border-color 0.3s; }
        .mmv-pledge-item:hover { border-left-color: #1e9bf0; }
        .mmv-pledge-title { font-family: var(--font-clash, 'Clash Display', sans-serif); font-size: 17px; font-weight: 600; margin-bottom: 8px; }
        .mmv-pledge-body { font-size: 14.5px; line-height: 1.7; color: rgba(240,240,243,0.5); max-width: 680px; }
        .mmv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .mmv-card { display: block; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-top: 2px solid transparent; padding: 22px; text-decoration: none; color: #f0f0f3; transition: border-color 0.3s, background 0.3s; }
        .mmv-card:hover { border-top-color: #1e9bf0; background: rgba(30,155,240,0.05); }
        .mmv-card-name { font-family: var(--font-clash, 'Clash Display', sans-serif); font-size: 17px; font-weight: 600; }
        .mmv-card-where { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(240,240,243,0.3); margin-top: 6px; }
        .mmv-card-url { font-size: 12.5px; color: #1e9bf0; margin-top: 12px; }
        .mmv-who { font-size: 15px; line-height: 1.85; color: rgba(240,240,243,0.55); max-width: 680px; }
        .mmv-who strong { color: #f0f0f3; font-weight: 500; }
        .mmv-who a { color: #1e9bf0; text-decoration: none; }
        .mmv-contact { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 26px; }
        .mmv-btn { display: inline-block; border: 1px solid #1e9bf0; color: #1e9bf0; padding: 13px 26px; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; text-decoration: none; position: relative; overflow: hidden; transition: color 0.35s; }
        .mmv-btn::before { content: ''; position: absolute; inset: 0; background: #1e9bf0; transform: translateY(101%); transition: transform 0.35s; z-index: -1; }
        .mmv-btn:hover { color: #06060a; }
        .mmv-btn:hover::before { transform: translateY(0); }
        .mmv-report { border: 1px solid rgba(30,155,240,0.35); background: rgba(30,155,240,0.06); padding: 26px 28px; margin-top: 88px; }
        .mmv-report-title { font-family: var(--font-clash, 'Clash Display', sans-serif); font-size: 15px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 10px; }
        .mmv-report-body { font-size: 14.5px; line-height: 1.7; color: rgba(240,240,243,0.55); }
        .mmv-footer { margin-top: 100px; padding-top: 28px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; letter-spacing: 0.08em; color: rgba(240,240,243,0.3); display: flex; flex-wrap: wrap; gap: 8px 24px; justify-content: space-between; }
        .mmv-reveal { opacity: 0; transform: translateY(40px); transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1); }
        .mmv-reveal.mmv-in { opacity: 1; transform: translateY(0); }
      `}</style>

      <div className="mmv-wrap">
        <nav className="mmv-nav">
          <a className="mmv-logo" href="/">MACHINE<span>MIND</span></a>
          <a className="mmv-logo" href="https://instagram.com/machinemindconsulting" target="_blank" rel="noopener">IG<span>.</span></a>
        </nav>

        <div className="mmv-eyebrow mmv-reveal">Verificación oficial</div>
        <h1 className="mmv-h1 mmv-reveal">
          ¿Te escribió MachineMind?<br />
          <em>Verificálo en 10 segundos.</em>
        </h1>
        <p className="mmv-lede mmv-reveal">
          Sabemos que en El Salvador y toda la región hay demasiadas estafas por WhatsApp.
          Por eso existe esta página: para que confirmés, vos mismo y en segundos, que quien
          te escribió somos realmente nosotros.
        </p>

        <section className="mmv-sec mmv-reveal">
          <div className="mmv-sec-title">Números oficiales de WhatsApp</div>
          <div className="mmv-numbers">
            {OFFICIAL_NUMBERS.map((n) => (
              <div className="mmv-num" key={n.number}>
                <div className="mmv-num-tel">{n.display}</div>
                <div className="mmv-num-label">{n.label}</div>
              </div>
            ))}
          </div>
          <p className="mmv-note">
            <strong>Si el número que te escribió está en esta lista, somos nosotros.</strong> Todos
            nuestros perfiles de WhatsApp muestran el logo de MachineMind, la categoría
            &ldquo;Servicio profesional&rdquo;, esta página web y nuestro correo. Próximamente
            también línea local +503 para llamadas.
          </p>
        </section>

        <section className="mmv-sec mmv-reveal">
          <div className="mmv-sec-title">Nuestro compromiso — lo que jamás hacemos</div>
          <div className="mmv-pledge">
            {PLEDGE.map((p) => (
              <div className="mmv-pledge-item" key={p.title}>
                <div className="mmv-pledge-title">{p.title}</div>
                <div className="mmv-pledge-body">{p.body}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mmv-sec mmv-reveal">
          <div className="mmv-sec-title">Trabajo real que podés visitar</div>
          <div className="mmv-grid">
            {WORK.map((w) => (
              <a className="mmv-card" key={w.name} href={w.url} target="_blank" rel="noopener">
                <div className="mmv-card-name">{w.name}</div>
                <div className="mmv-card-where">{w.where}</div>
                <div className="mmv-card-url">{w.url.replace('https://', '')}</div>
              </a>
            ))}
          </div>
          <p className="mmv-note">
            Y la prueba más directa: pedinos una <strong>demo construida para tu negocio</strong>.
            La ves funcionando antes de pagar un solo centavo. Un estafador no construye software
            para vos gratis.
          </p>
        </section>

        <section className="mmv-sec mmv-reveal">
          <div className="mmv-sec-title">Quiénes somos</div>
          <p className="mmv-who">
            <strong>MachineMind LLC</strong> es una empresa registrada en Estados Unidos, fundada
            por <strong>Phil McGill</strong>, que construye software y asistentes de inteligencia
            artificial por WhatsApp para negocios en El Salvador, Panamá y Colombia. Nuestro
            trabajo es público: <a href="/">machinemindconsulting.com</a> ·{' '}
            <a href="https://instagram.com/machinemindconsulting" target="_blank" rel="noopener">
              @machinemindconsulting
            </a>{' '}
            · machinemindconsulting@gmail.com
          </p>
          <div className="mmv-contact">
            <a className="mmv-btn" href="https://wa.me/17869472533?text=Hola%2C%20quiero%20verificar%20un%20mensaje%20que%20recib%C3%AD" target="_blank" rel="noopener">
              Verificar por WhatsApp
            </a>
            <a className="mmv-btn" href="mailto:machinemindconsulting@gmail.com">Escribir por correo</a>
          </div>
        </section>

        <div className="mmv-report mmv-reveal">
          <div className="mmv-report-title">¿Alguien pidió dinero usando nuestro nombre?</div>
          <div className="mmv-report-body">
            Si una persona o número que NO está en esta lista te pidió pagos, transferencias o
            códigos diciendo ser MachineMind, es una estafa. Reportánosla por WhatsApp o correo
            y la denunciamos — nos tomamos esto en serio porque nuestro nombre es nuestro negocio.
          </div>
        </div>

        <footer className="mmv-footer">
          <div>MACHINEMIND LLC — Software e IA para LATAM</div>
          <div>Esta es la única página oficial de verificación</div>
        </footer>
      </div>
    </main>
  );
}

"use client";

/**
 * /web since 2026-09-30 — the number-only capture (Phil's pivot).
 *
 * One field: the WhatsApp number. Submitting creates the lead and fires the
 * "LLAMAR AHORA" alert; Fernanda dials within minutes during her shift
 * (9:00–18:00 SV, Mon–Sat). Off shift, the done screen sends the lead into the
 * funnel line's WhatsApp (+1 786-257-0284), where the responder holds the
 * conversation until she starts. The full form still exists for the team and
 * the chat flows at /web?form=full.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./web.module.css";
import { COPY, type Lang } from "./copy";
import {
  CLOSED_DIALS,
  COUNTRY_CODES,
  FREE_DAYS,
  isOpenMarket,
  MARKET_INFO,
  MM_WHATSAPP,
  MM_WHATSAPP_DISPLAY,
  MONTHLY_PRICE_USD,
  OPEN_MARKETS,
  toE164,
  type Market,
} from "@/lib/web-gratis/config";
import type { WebGratisErrorCode } from "@/lib/web-gratis/schema";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

interface Attribution {
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  landing_url?: string;
}

interface Done {
  referralCode: string;
  leadEventId: string | null;
  onDuty: boolean;
  nextStart: string;
}

interface QuickConfig {
  highDemand: boolean;
  onDuty: boolean;
  nextStart: string;
}

const QUICK = {
  es: {
    marketsLabel: "Países disponibles",
    coverage: "Páginas web para negocios de El Salvador y Panamá.",
    lede: "Deje su número de WhatsApp y nuestra especialista lo llama para dejar todo listo. Sin formularios largos: todo lo demás lo vemos en la llamada.",
    chips: ["Diseño $0", `${FREE_DAYS} días gratis en línea`, "Solo su número — 10 segundos"],
    cardTitle: "Su página web gratis empieza aquí",
    phoneLabel: "Su WhatsApp",
    onDutyNow: "🟢 Estamos en línea ahora: lo llamamos en minutos.",
    offDutyNow: (next: string) => `Ahora mismo atendemos por WhatsApp; nuestra especialista lo llama ${next}.`,
    submit: "Quiero mi web gratis",
    submitting: "Enviando…",
    consent: `Al enviar acepta que lo llamemos y le escribamos por WhatsApp sobre su página web. Gratis de verdad: diseño $0 y ${FREE_DAYS} días en línea gratis; después $${MONTHLY_PRICE_USD} USD/mes solo si quiere que la sigamos alojando. Sin contrato.`,
    doneOnTitle: "¡Listo! Lo estamos llamando",
    doneOnBody:
      "Un representante de MachineMind se comunicará con usted dentro de las próximas 24 horas —normalmente en minutos— para dejar lista su página web. Le llamaremos desde un número de Estados Unidos: por favor esté atento a sus llamadas y a su WhatsApp para avanzar con su página.",
    doneOffTitle: "¡Recibido!",
    doneOffBody: (next: string) =>
      `Un representante de MachineMind se comunicará con usted dentro de las próximas 24 horas (${next}) para dejar lista su página web. Por favor esté atento a sus llamadas y a su WhatsApp. ¿Quiere adelantar? Escríbanos por WhatsApp ahora y dejamos su página encaminada de una vez.`,
    doneWa: "Escribir por WhatsApp ahora",
    doneWaText: (code: string) =>
      `Hola 👋 Acabo de dejar mi número en machinemindconsulting.com/web para mi página web gratis (código ${code}). Quiero dejarla encaminada.`,
    doneOnWaHint: `Si prefiere escribir, nuestro WhatsApp es ${MM_WHATSAPP_DISPLAY}.`,
    another: "Registrar otro negocio",
    highDemand: COPY.es.highDemand,
    errorFallback: "No se pudo enviar. Escríbanos por WhatsApp y lo resolvemos:",
  },
  en: {
    marketsLabel: "Available countries",
    coverage: "Websites for businesses in El Salvador and Panama.",
    lede: "Leave your WhatsApp number and our specialist calls you to get everything set up. No long forms — we cover the rest on the call.",
    chips: ["$0 design", `${FREE_DAYS} days free online`, "Just your number — 10 seconds"],
    cardTitle: "Your free website starts here",
    phoneLabel: "Your WhatsApp",
    onDutyNow: "🟢 We're online now: we'll call you within minutes.",
    offDutyNow: (next: string) => `Right now we reply on WhatsApp; our specialist calls you ${next} (El Salvador time).`,
    submit: "I want my free website",
    submitting: "Sending…",
    consent: `By sending you agree we may call and message you on WhatsApp about your website. Truly free: $0 design and ${FREE_DAYS} days free online; then $${MONTHLY_PRICE_USD} USD/mo only if you want us to keep hosting it. No contract.`,
    doneOnTitle: "Done! We're calling you",
    doneOnBody:
      "A MachineMind representative will reach out within the next 24 hours —usually within minutes— to get your website ready. We'll call from a US number, so please keep an eye on your calls and WhatsApp to move your site forward.",
    doneOffTitle: "Received!",
    doneOffBody: (next: string) =>
      `A MachineMind representative will reach out within the next 24 hours (${next}, El Salvador time) to get your website ready. Please keep an eye on your calls and WhatsApp. Want to get ahead? Message us on WhatsApp now and we'll get your site moving right away.`,
    doneWa: "Message us on WhatsApp now",
    doneWaText: (code: string) =>
      `Hi 👋 I just left my number at machinemindconsulting.com/web for my free website (code ${code}). I'd like to get it moving.`,
    doneOnWaHint: `If you'd rather write, our WhatsApp is ${MM_WHATSAPP_DISPLAY}.`,
    another: "Register another business",
    highDemand: COPY.en.highDemand,
    errorFallback: "It didn't send. Message us on WhatsApp and we'll sort it out:",
  },
} as const;

function flagClass(market: Market): string {
  return market === "CO" ? styles.flagCO : market === "PA" ? styles.flagPA : styles.flagSV;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

function collectAttribution(): Attribution {
  try {
    const p = new URLSearchParams(window.location.search);
    const pick = (k: string) => p.get(k)?.slice(0, 200) || undefined;
    return {
      ref: p.get("ref")?.slice(0, 64) || undefined,
      utm_source: pick("utm_source"),
      utm_medium: pick("utm_medium"),
      utm_campaign: pick("utm_campaign"),
      utm_content: pick("utm_content"),
      utm_term: pick("utm_term"),
      fbclid: p.get("fbclid")?.slice(0, 500) || undefined,
      landing_url: window.location.href.slice(0, 1000),
    };
  } catch {
    return {};
  }
}

function validationMessage(t: Lang, dial: string): string {
  const v = COPY[t].validation;
  if (dial === MARKET_INFO.SV.dial) return v.whatsappSV;
  if (dial === MARKET_INFO.PA.dial) return v.whatsappPA;
  if (dial === MARKET_INFO.CO.dial) return v.whatsappCO;
  return COPY[t].errors.invalid_whatsapp;
}

export interface QuickClientProps {
  initialMarket: Market | null;
  marketHint: Market | null;
}

export default function QuickClient({ initialMarket, marketHint }: QuickClientProps) {
  // Only OPEN markets may frame the page: a Colombian (or any other closed/foreign)
  // IP hint must never put the wrong flag on an El Salvador + Panamá campaign.
  const startMarket: Market = initialMarket ?? (isOpenMarket(marketHint) ? (marketHint as Market) : "SV");
  const [lang, setLang] = useState<Lang>("es");
  const [market, setMarket] = useState<Market>(startMarket);
  const [dial, setDial] = useState<string>(MARKET_INFO[startMarket].dial);
  const [local, setLocal] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [config, setConfig] = useState<QuickConfig | null>(null);
  const quickIdRef = useRef<string>("");
  const trackedRef = useRef(false);
  if (!quickIdRef.current) quickIdRef.current = newId();

  const t = QUICK[lang];
  const c = COPY[lang];

  // Browser timezone beats the server's IP hint (same rule as the full form).
  useEffect(() => {
    if (initialMarket) return;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const match = OPEN_MARKETS.find((m) => MARKET_INFO[m].timezone === tz);
      if (match) {
        setMarket(match);
        setDial(MARKET_INFO[match].dial);
      }
    } catch {
      // Hint only.
    }
  }, [initialMarket]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/web-gratis/config");
        const json = (await res.json()) as { data?: { highDemand?: boolean; onDuty?: boolean; nextStart?: string } };
        if (alive && json.data) {
          setConfig({
            highDemand: !!json.data.highDemand,
            onDuty: json.data.onDuty !== false,
            nextStart: json.data.nextStart ?? "",
          });
        }
      } catch {
        // The availability line is a nicety; the form works without it.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function chooseMarket(m: Market) {
    setMarket(m);
    setDial(MARKET_INFO[m].dial);
    setError(null);
  }

  async function submit() {
    if (sending) return;
    const e164 = toE164(dial, local);
    if (!e164) {
      setError(validationMessage(lang, dial));
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/web-gratis/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quickId: quickIdRef.current,
          lang,
          website: honeypot || undefined,
          countryCode: dial,
          whatsappLocal: local,
          attribution: collectAttribution(),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: Done;
        error?: WebGratisErrorCode;
      } | null;
      if (res.ok && json?.data) {
        setDone(json.data);
        if (!trackedRef.current && json.data.leadEventId && typeof window.fbq === "function") {
          trackedRef.current = true;
          try {
            window.fbq("track", "Lead", {}, { eventID: json.data.leadEventId });
          } catch {
            // A blocked pixel cannot turn a successfully saved lead into a form error.
          }
        }
      } else {
        setError(json?.error ? (c.errors[json.error] ?? c.errors.server_error) : c.errors.network);
      }
    } catch {
      setError(c.errors.network);
    } finally {
      setSending(false);
    }
  }

  function startOver() {
    quickIdRef.current = newId();
    trackedRef.current = false;
    setLocal("");
    setDone(null);
    setError(null);
  }

  const mc = c.market[market];
  const waHref = done
    ? `https://wa.me/${MM_WHATSAPP}?text=${encodeURIComponent(t.doneWaText(done.referralCode))}`
    : `https://wa.me/${MM_WHATSAPP}`;

  return (
    <main className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={styles.top}>
          <Link href="/" className={styles.brand}>
            <span className={`${styles.flagMini} ${flagClass(market)}`} aria-hidden="true" />
            MachineMind
          </Link>
          <button
            type="button"
            className={styles.langBtn}
            onClick={() => setLang(lang === "es" ? "en" : "es")}
            lang={lang === "es" ? "en" : "es"}
          >
            {c.langToggle}
          </button>
        </header>

        <div className={styles.layout}>
          <section className={styles.hero}>
            <p className={`${styles.badge} ${styles.rise}`}>
              {c.badge}
            </p>
            <ul className={`${styles.campaignMarkets} ${styles.rise}`} aria-label={t.marketsLabel}>
              {OPEN_MARKETS.map((m) => (
                <li key={m}>
                  <span className={`${styles.flagStripe} ${flagClass(m)}`} aria-hidden="true" />
                  <span>{c.market[m].name}</span>
                </li>
              ))}
            </ul>
            <h1 className={`${styles.title} ${styles.rise} ${styles.d1}`}>
              {c.titleA}
              <span className={styles.titleB}>{c.titleB}</span>
            </h1>
            <p className={`${styles.align} ${styles.rise} ${styles.d1}`}>{t.coverage}</p>
            <p className={`${styles.lede} ${styles.rise} ${styles.d2}`}>{t.lede}</p>
            {config?.highDemand ? <p className={styles.demand}>{t.highDemand}</p> : null}
            <ul className={`${styles.chips} ${styles.rise} ${styles.d3}`}>
              {t.chips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          </section>

          <section id="formulario" className={styles.formCol} aria-live="polite">
            <noscript>
              <div className={styles.alert}>
                <p>{COPY.es.noscript}</p>
                <a className={styles.alertLink} href={`https://wa.me/${MM_WHATSAPP}`}>
                  {COPY.es.whatsappHelp}
                </a>
              </div>
            </noscript>

            {done ? (
              <div className={`${styles.card} ${styles.done}`}>
                <h2 className={styles.doneTitle}>{done.onDuty ? t.doneOnTitle : t.doneOffTitle}</h2>
                <p className={styles.doneBody}>{done.onDuty ? t.doneOnBody : t.doneOffBody(done.nextStart)}</p>
                <a className={styles.btnWa} href={waHref} target="_blank" rel="noopener noreferrer">
                  {t.doneWa}
                </a>
                {done.onDuty ? <p className={styles.fine}>{t.doneOnWaHint}</p> : null}
                <button type="button" className={styles.btnGhost} onClick={startOver}>
                  {t.another}
                </button>
              </div>
            ) : (
              <form
                className={`${styles.card} ${styles.rise} ${styles.d2}`}
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <p className={styles.label}>{t.cardTitle}</p>
                {config ? <p className={styles.hint}>{config.onDuty ? t.onDutyNow : t.offDutyNow(config.nextStart)}</p> : null}

                <div className={styles.hp} aria-hidden="true">
                  <label>
                    Website
                    <input tabIndex={-1} autoComplete="off" name="mm_hp_field" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                  </label>
                </div>

                {OPEN_MARKETS.length > 1 ? (
                  <div className={styles.marketRow} role="radiogroup" aria-label={c.countryPicker.label}>
                    {OPEN_MARKETS.map((m) => (
                      <label key={m} className={market === m ? styles.marketOn : styles.market}>
                        <input
                          type="radio"
                          name="quick-market"
                          value={m}
                          checked={market === m}
                          onChange={() => chooseMarket(m)}
                          className={styles.sr}
                        />
                        <span className={`${styles.flagStripe} ${flagClass(m)}`} aria-hidden="true" />
                        <span>{c.market[m].name}</span>
                      </label>
                    ))}
                  </div>
                ) : null}

                <label className={styles.label} htmlFor="wg-quick-phone">
                  {t.phoneLabel}
                </label>
                <div className={styles.phoneRow}>
                  <select
                    aria-label={c.fields.whatsapp.country}
                    className={styles.select}
                    value={dial}
                    onChange={(e) => {
                      setDial(e.target.value);
                      const m = OPEN_MARKETS.find((om) => MARKET_INFO[om].dial === e.target.value);
                      if (m) setMarket(m);
                    }}
                  >
                    {COUNTRY_CODES.filter((cc) => !CLOSED_DIALS.includes(cc.code)).map((cc) => (
                      <option key={cc.code} value={cc.code}>
                        {cc.label}
                      </option>
                    ))}
                  </select>
                  <input
                    id="wg-quick-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    enterKeyHint="go"
                    maxLength={24}
                    placeholder={mc.phonePlaceholder}
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    className={error ? `${styles.input} ${styles.inputErr}` : styles.input}
                  />
                </div>
                {error ? (
                  <p className={styles.alert} role="alert">
                    {error}{" "}
                    <a className={styles.alertLink} href={`https://wa.me/${MM_WHATSAPP}`}>
                      {c.whatsappHelp}
                    </a>
                  </p>
                ) : null}

                <button type="submit" className={styles.btnPrimary} disabled={sending}>
                  {sending ? t.submitting : t.submit}
                </button>
                <p className={styles.consent}>{t.consent}</p>
                <p className={styles.fine}>{c.disclaimer}</p>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

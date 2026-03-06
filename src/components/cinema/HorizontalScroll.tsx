"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/store/portfolio";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register ScrollTrigger plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Bilingual translations
const translations = {
  es: {
    badge: "Capacidades",
    title: "Lo Que Entregamos",
    scroll: "Desliza para explorar",
  },
  en: {
    badge: "Capabilities",
    title: "What We Deliver",
    scroll: "Scroll to explore",
  },
};

// Panel data with gold accents
const panelsData = {
  es: [
    {
      stat: "50K+",
      title: "Sofia AI Concierge",
      description:
        "Inteligencia bilingüe 24/7. Maneja reservas, responde preguntas, cierra ventas mientras duermes. Entrenamiento específico de industria en español e inglés.",
    },
    {
      stat: "99.9%",
      title: "Sistemas Autopoiéticos",
      description:
        "Arquitectura auto-mantenida que se monitorea, sana y optimiza sola. Infraestructura cero-mantenimiento que evoluciona con tu negocio.",
    },
    {
      stat: "44+",
      title: "Entrega Full-Stack",
      description:
        "Del concepto al despliegue en semanas, no meses. Interfaces hermosas respaldadas por infraestructura a prueba de balas. Next.js, Supabase, Vercel.",
    },
    {
      stat: "$2.4M",
      title: "Recuperación de Ingresos",
      description:
        "Deja de perder $120,000+ anuales por reservas perdidas y respuestas lentas. Nuestra IA captura ingresos 24/7/365 mientras duermes.",
    },
  ],
  en: [
    {
      stat: "50K+",
      title: "Sofia AI Concierge",
      description:
        "24/7 bilingual intelligence. Handles bookings, answers questions, closes sales while you sleep. Industry-specific training in Spanish and English.",
    },
    {
      stat: "99.9%",
      title: "Autopoietic Systems",
      description:
        "Self-maintaining architecture that monitors, heals, and optimizes itself. Zero-maintenance infrastructure that evolves with your business.",
    },
    {
      stat: "44+",
      title: "Full-Stack Delivery",
      description:
        "From concept to deployment in weeks, not months. Beautiful interfaces backed by bulletproof infrastructure. Next.js, Supabase, Vercel.",
    },
    {
      stat: "$2.4M",
      title: "Revenue Recovery",
      description:
        "Stop losing $120,000+ annually to missed bookings and slow responses. Our AI captures revenue 24/7/365 while you sleep.",
    },
  ],
};

/**
 * HorizontalScroll - GSAP ScrollTrigger Horizontal Scrolling Section
 * 
 * Uses pinning and scrub for smooth horizontal scroll tied to vertical scroll.
 * Gold accent color (#c9a96e) for luxury aesthetic.
 * Desktop only - falls back to vertical layout on mobile.
 */
export default function HorizontalScroll() {
  const language = useLanguage();
  const t = translations[language];
  const panels = panelsData[language];
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // GSAP ScrollTrigger horizontal scroll
  useEffect(() => {
    // Skip on mobile or if reduced motion preferred
    if (isMobile) return;
    
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    if (!wrapper || !track) return;

    // Create the horizontal scroll animation
    const ctx = gsap.context(() => {
      gsap.to(track, {
        x: () => -(track.scrollWidth - window.innerWidth),
        ease: "none",
        scrollTrigger: {
          trigger: wrapper,
          pin: true,
          scrub: 1,
          end: () => "+=" + (track.scrollWidth - window.innerWidth),
          invalidateOnRefresh: true,
        },
      });
    }, wrapper);

    return () => {
      ctx.revert();
    };
  }, [isMobile]);

  // Mobile vertical layout
  if (isMobile) {
    return (
      <section
        className="py-20 px-4"
        style={{ background: "#0a0a0f" }}
      >
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="mb-12 text-center">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] mb-6"
              style={{
                border: "1px solid #c9a96e",
                color: "#c9a96e",
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: "#c9a96e" }}
              />
              {t.badge}
            </span>
            <h2
              className="font-heading text-3xl sm:text-4xl font-bold"
              style={{ color: "#ffffff" }}
            >
              {t.title}
            </h2>
          </div>

          {/* Vertical cards */}
          <div className="grid gap-8 sm:grid-cols-2">
            {panels.map((panel, i) => (
              <div
                key={i}
                className="p-6 sm:p-8"
                style={{
                  border: "1px solid rgba(201, 169, 110, 0.2)",
                  background: "rgba(201, 169, 110, 0.03)",
                }}
              >
                {/* Stat */}
                <div
                  className="text-4xl sm:text-5xl font-bold font-mono mb-4"
                  style={{
                    color: "#c9a96e",
                    textShadow: "0 0 30px rgba(201, 169, 110, 0.3)",
                  }}
                >
                  {panel.stat}
                </div>

                {/* Title */}
                <h3
                  className="font-heading text-xl sm:text-2xl font-bold mb-3"
                  style={{ color: "#ffffff" }}
                >
                  {panel.title}
                </h3>

                {/* Description */}
                <p
                  className="text-sm sm:text-base leading-relaxed"
                  style={{ color: "rgba(255, 255, 255, 0.6)" }}
                >
                  {panel.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Desktop horizontal scroll layout
  return (
    <section
      ref={wrapperRef}
      className="relative overflow-hidden"
      style={{ background: "#0a0a0f" }}
    >
      {/* Horizontal track - 4 panels at 100vw each */}
      <div
        ref={trackRef}
        className="flex h-screen"
        style={{ width: `${panels.length * 100}vw` }}
      >
        {panels.map((panel, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-screen h-screen flex items-center justify-center px-8 md:px-16 lg:px-24"
          >
            <div className="max-w-5xl w-full">
              {/* Panel number indicator */}
              <div className="flex items-center gap-4 mb-8">
                <span
                  className="text-sm font-mono uppercase tracking-[0.3em]"
                  style={{ color: "#c9a96e" }}
                >
                  {String(i + 1).padStart(2, "0")} / {String(panels.length).padStart(2, "0")}
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: "rgba(201, 169, 110, 0.3)" }}
                />
                {i === 0 && (
                  <span
                    className="inline-flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase tracking-[0.15em]"
                    style={{
                      border: "1px solid rgba(201, 169, 110, 0.4)",
                      color: "#c9a96e",
                    }}
                  >
                    {t.badge}
                  </span>
                )}
              </div>

              {/* Stat - Large and prominent */}
              <div
                className="text-[8rem] md:text-[10rem] lg:text-[12rem] font-bold font-mono leading-none mb-6"
                style={{
                  color: "#c9a96e",
                  textShadow: "0 0 60px rgba(201, 169, 110, 0.25)",
                }}
              >
                {panel.stat}
              </div>

              {/* Title */}
              <h3
                className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-6"
                style={{ color: "#ffffff" }}
              >
                {panel.title}
              </h3>

              {/* Description */}
              <p
                className="text-lg md:text-xl lg:text-2xl leading-relaxed max-w-3xl"
                style={{ color: "rgba(255, 255, 255, 0.6)" }}
              >
                {panel.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {panels.map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              background: i === 0 ? "#c9a96e" : "rgba(201, 169, 110, 0.3)",
            }}
          />
        ))}
      </div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-12 right-12 z-20 flex items-center gap-3"
        style={{ color: "rgba(201, 169, 110, 0.6)" }}
      >
        <span className="text-sm font-mono uppercase tracking-wider">
          {t.scroll}
        </span>
        <svg
          className="w-5 h-5 animate-pulse"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
      </div>

      {/* Vertical scroll indicator on left */}
      <div
        className="absolute left-12 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2"
        style={{ color: "rgba(201, 169, 110, 0.4)" }}
      >
        <div className="w-px h-16" style={{ background: "rgba(201, 169, 110, 0.2)" }} />
        <svg
          className="w-4 h-4 animate-bounce"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/store/portfolio";

// Bilingual translations
const translations = {
  es: {
    badge: "Capacidades",
    title: "Lo Que Entregamos",
    scroll: "Desliza",
  },
  en: {
    badge: "Capabilities",
    title: "What We Deliver",
    scroll: "Scroll",
  },
};

// Bilingual capability data
const capabilitiesData = {
  es: [
    {
      number: "01",
      title: "Sofia AI Concierge",
      subtitle: "Inteligencia Bilingüe 24/7",
      description:
        "Maneja reservas, responde preguntas, cierra ventas mientras duermes. Fluidez en español e inglés con entrenamiento específico de industria.",
      stat: "50K+",
      statLabel: "Conversaciones Manejadas",
      features: [
        "Integración WhatsApp",
        "Automatización de Reservas",
        "Calificación de Leads",
        "Multi-Idioma",
      ],
    },
    {
      number: "02",
      title: "Sistemas Autopoiéticos",
      subtitle: "Arquitectura Auto-Mantenida",
      description:
        "Sistemas que se monitorean, sanan y optimizan solos. Infraestructura cero-mantenimiento que evoluciona con tu negocio.",
      stat: "99.9%",
      statLabel: "Disponibilidad del Sistema",
      features: [
        "Auto-Reparación",
        "Auto-Escalado",
        "Mantenimiento Predictivo",
        "Monitoreo en Tiempo Real",
      ],
    },
    {
      number: "03",
      title: "Entrega Full-Stack",
      subtitle: "Excelencia de Principio a Fin",
      description:
        "Del concepto al despliegue en semanas, no meses. Interfaces hermosas respaldadas por infraestructura a prueba de balas.",
      stat: "44+",
      statLabel: "Proyectos Entregados",
      features: [
        "Next.js + React",
        "Backend Supabase",
        "Deploy en Vercel",
        "Integraciones Personalizadas",
      ],
    },
    {
      number: "04",
      title: "Recuperación de Ingresos",
      subtitle: "Captura Cada Dólar",
      description:
        "Deja de perder $120,000+ anuales por reservas perdidas y respuestas lentas. Nuestra IA captura ingresos 24/7/365.",
      stat: "$2.4M+",
      statLabel: "Ingresos Recuperados",
      features: [
        "Ventas Fuera de Horario",
        "Respuesta Instantánea",
        "Nutrición de Leads",
        "Optimización de Conversión",
      ],
    },
  ],
  en: [
    {
      number: "01",
      title: "Sofia AI Concierge",
      subtitle: "24/7 Bilingual Intelligence",
      description:
        "Handles bookings, answers questions, closes sales while you sleep. Spanish and English fluency with industry-specific training.",
      stat: "50K+",
      statLabel: "Conversations Handled",
      features: [
        "WhatsApp Integration",
        "Booking Automation",
        "Lead Qualification",
        "Multi-Language",
      ],
    },
    {
      number: "02",
      title: "Autopoietic Systems",
      subtitle: "Self-Maintaining Architecture",
      description:
        "Systems that monitor, heal, and optimize themselves. Zero-maintenance infrastructure that evolves with your business.",
      stat: "99.9%",
      statLabel: "System Uptime",
      features: [
        "Self-Healing",
        "Auto-Scaling",
        "Predictive Maintenance",
        "Real-Time Monitoring",
      ],
    },
    {
      number: "03",
      title: "Full-Stack Delivery",
      subtitle: "End-to-End Excellence",
      description:
        "From concept to deployment in weeks, not months. Beautiful interfaces backed by bulletproof infrastructure.",
      stat: "44+",
      statLabel: "Projects Delivered",
      features: [
        "Next.js + React",
        "Supabase Backend",
        "Vercel Deploy",
        "Custom Integrations",
      ],
    },
    {
      number: "04",
      title: "Revenue Recovery",
      subtitle: "Capture Every Dollar",
      description:
        "Stop losing $120,000+ annually to missed bookings and slow responses. Our AI captures revenue 24/7/365.",
      stat: "$2.4M+",
      statLabel: "Revenue Recovered",
      features: [
        "After-Hours Sales",
        "Instant Response",
        "Lead Nurturing",
        "Conversion Optimization",
      ],
    },
  ],
};

/**
 * Horizontal Scroll Section
 * GSAP ScrollTrigger pinned horizontal scrolling
 * WORLD-CLASS $50M AESTHETIC
 */
export default function HorizontalScroll() {
  const language = useLanguage();
  const t = translations[language];
  const capabilities = capabilitiesData[language];
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 },
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Skip GSAP on mobile - use vertical layout instead
    if (isMobile) return;

    // Check for prefers-reduced-motion - disable GSAP animations if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      console.info(
        "[HorizontalScroll] Reduced motion preference detected - skipping GSAP",
      );
      return;
    }

    const gsap = (window as unknown as { gsap?: unknown }).gsap;
    const ScrollTrigger = (window as unknown as { ScrollTrigger?: unknown })
      .ScrollTrigger;

    if (!gsap || !ScrollTrigger || !containerRef.current || !trackRef.current)
      return;

    const g = gsap as {
      registerPlugin: (p: unknown) => void;
      to: (
        t: unknown,
        c: object,
      ) => { scrollTrigger?: { kill: () => void } } | null;
    };
    const ST = ScrollTrigger as { create: (c: object) => { kill: () => void } };

    g.registerPlugin(ST);

    const track = trackRef.current;
    const panels = track.querySelectorAll(".h-panel");
    const totalWidth = (panels.length - 1) * window.innerWidth;

    const tween = g.to(track, {
      x: -totalWidth,
      ease: "none",
      scrollTrigger: {
        trigger: containerRef.current,
        pin: true,
        scrub: 1,
        end: () => "+=" + totalWidth,
      },
    });

    return () => {
      if (tween && tween.scrollTrigger) {
        tween.scrollTrigger.kill();
      }
    };
  }, [isMobile]);

  // Mobile vertical layout
  if (isMobile) {
    return (
      <section
        ref={containerRef}
        className="py-16 px-4"
        style={{ background: "var(--mm-background)" }}
      >
        <div className="container-luxury">
          {/* Section header */}
          <div className="mb-8">
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-[0.2em] mb-4"
              style={{
                border: "1px solid var(--mm-border-hover)",
                color: "var(--mm-blue-core)",
              }}
            >
              <span className="w-1.5 h-1.5 bg-[var(--mm-blue-core)] animate-pulse" />
              {t.badge}
            </span>
            <h2
              className="font-heading text-2xl sm:text-3xl font-bold"
              style={{ color: "var(--mm-text)" }}
            >
              {t.title}
            </h2>
          </div>

          {/* Vertical cards */}
          <div className="space-y-6">
            {capabilities.map((cap, i) => (
              <div
                key={i}
                className="p-4 sm:p-6"
                style={{
                  border: "1px solid var(--mm-border)",
                  background: "rgba(0, 180, 255, 0.03)",
                }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <span
                    className="text-3xl sm:text-4xl font-bold font-mono"
                    style={{ color: "var(--mm-blue-core)", opacity: 0.3 }}
                  >
                    {cap.number}
                  </span>
                  <div className="flex-1">
                    <div
                      className="text-xs font-mono uppercase tracking-wider mb-1"
                      style={{ color: "var(--mm-blue-core)" }}
                    >
                      {cap.subtitle}
                    </div>
                    <h3
                      className="font-heading text-xl sm:text-2xl font-bold"
                      style={{ color: "var(--mm-text)" }}
                    >
                      {cap.title}
                    </h3>
                  </div>
                </div>

                <p
                  className="text-sm sm:text-base mb-4 leading-relaxed"
                  style={{ color: "var(--mm-text-muted)" }}
                >
                  {cap.description}
                </p>

                {/* Stat */}
                <div
                  className="inline-block px-4 py-2 mb-4"
                  style={{
                    border: "1px solid var(--mm-border-hover)",
                    background: "rgba(0, 180, 255, 0.05)",
                  }}
                >
                  <span
                    className="text-2xl sm:text-3xl font-bold font-mono mr-2"
                    style={{
                      color: "var(--mm-blue-bright)",
                      textShadow: "0 0 20px rgba(0, 212, 255, 0.4)",
                    }}
                  >
                    {cap.stat}
                  </span>
                  <span
                    className="text-xs uppercase tracking-wider font-mono"
                    style={{ color: "var(--mm-text-muted)" }}
                  >
                    {cap.statLabel}
                  </span>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2">
                  {cap.features.map((feature, j) => (
                    <span
                      key={j}
                      className="px-2 py-1 text-xs font-mono"
                      style={{
                        border: "1px solid var(--mm-border)",
                        color: "var(--mm-text-muted)",
                      }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
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
      ref={containerRef}
      className="relative overflow-hidden"
      style={{
        height: `${capabilities.length * 100}vh`,
        background: "var(--mm-background)",
      }}
    >
      {/* Section header */}
      <div
        className="absolute top-0 left-0 right-0 z-20 py-8"
        style={{
          background:
            "linear-gradient(to bottom, var(--mm-background), transparent)",
        }}
      >
        <div className="container-luxury">
          <div
            className="flex items-center gap-4 mb-4"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.6s ease-out",
            }}
          >
            <span
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-[0.2em]"
              style={{
                border: "1px solid var(--mm-border-hover)",
                color: "var(--mm-blue-core)",
              }}
            >
              <span className="w-1.5 h-1.5 bg-[var(--mm-blue-core)] animate-pulse" />
              {t.badge}
            </span>
          </div>
          <h2
            className="font-heading text-3xl md:text-5xl font-bold"
            style={{
              color: "var(--mm-text)",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.6s ease-out 0.1s",
            }}
          >
            {t.title}
          </h2>
        </div>
      </div>

      {/* Horizontal track */}
      <div
        ref={trackRef}
        className="flex h-screen"
        style={{ width: `${capabilities.length * 100}vw` }}
      >
        {capabilities.map((cap, i) => (
          <div
            key={i}
            className="h-panel w-screen h-screen flex items-center justify-center px-8 md:px-16"
            style={{ background: "var(--mm-background)" }}
          >
            <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left: Content */}
              <div className="order-2 lg:order-1">
                <div
                  className="text-8xl md:text-9xl font-bold font-mono mb-6"
                  style={{
                    color: "var(--mm-blue-core)",
                    opacity: 0.15,
                    lineHeight: 1,
                  }}
                >
                  {cap.number}
                </div>
                <div
                  className="text-xs font-mono uppercase tracking-[0.3em] mb-4"
                  style={{ color: "var(--mm-blue-core)" }}
                >
                  {cap.subtitle}
                </div>
                <h3
                  className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-6"
                  style={{ color: "var(--mm-text)" }}
                >
                  {cap.title}
                </h3>
                <p
                  className="text-lg md:text-xl mb-8 leading-relaxed"
                  style={{ color: "var(--mm-text-muted)" }}
                >
                  {cap.description}
                </p>

                {/* Features */}
                <div className="flex flex-wrap gap-3 mb-8">
                  {cap.features.map((feature, j) => (
                    <span
                      key={j}
                      className="px-4 py-2 text-sm font-mono"
                      style={{
                        border: "1px solid var(--mm-border)",
                        color: "var(--mm-text-muted)",
                        background: "rgba(0, 180, 255, 0.03)",
                      }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: Stat */}
              <div className="order-1 lg:order-2 text-center lg:text-right">
                <div
                  className="inline-block p-12 lg:p-16"
                  style={{
                    border: "1px solid var(--mm-border-hover)",
                    background: "rgba(0, 180, 255, 0.03)",
                  }}
                >
                  <div
                    className="text-6xl md:text-7xl lg:text-8xl font-bold font-mono mb-4"
                    style={{
                      color: "var(--mm-blue-bright)",
                      textShadow: "0 0 40px rgba(0, 212, 255, 0.4)",
                    }}
                  >
                    {cap.stat}
                  </div>
                  <div
                    className="text-sm uppercase tracking-[0.2em] font-mono"
                    style={{ color: "var(--mm-text-muted)" }}
                  >
                    {cap.statLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {capabilities.map((_, i) => (
          <div
            key={i}
            className="w-12 h-1"
            style={{
              background: "var(--mm-border)",
            }}
          />
        ))}
      </div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-8 right-8 z-20 flex items-center gap-2 text-sm font-mono"
        style={{ color: "var(--mm-text-subtle)" }}
      >
        <span>{t.scroll}</span>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/store/portfolio";
import { RevealOnScroll } from "@/components/animation";

interface Capability {
  id: string;
  icon: string;
  titleEs: string;
  titleEn: string;
  descEs: string;
  descEn: string;
  detailEs: string;
  detailEn: string;
  color: string;
}

const capabilities: Capability[] = [
  {
    id: "ai",
    icon: "🤖",
    titleEs: "Automatización IA",
    titleEn: "AI Automation",
    descEs: "Agentes conversacionales 24/7",
    descEn: "24/7 conversational agents",
    detailEs:
      "Implementamos agentes de IA que manejan reservas, consultas y ventas automáticamente. Integración nativa con Claude y GPT para respuestas contextuales y naturales.",
    detailEn:
      "We implement AI agents that handle bookings, inquiries, and sales automatically. Native integration with Claude and GPT for contextual, natural responses.",
    color: "#00B4FF",
  },
  {
    id: "whatsapp",
    icon: "💬",
    titleEs: "WhatsApp Business",
    titleEn: "WhatsApp Business",
    descEs: "API oficial con automatización",
    descEn: "Official API with automation",
    detailEs:
      "Integración con la API oficial de WhatsApp Business. Mensajes masivos, automatización de seguimiento, y chatbots inteligentes que convierten leads en clientes.",
    detailEn:
      "Integration with official WhatsApp Business API. Bulk messaging, follow-up automation, and intelligent chatbots that convert leads into customers.",
    color: "#25D366",
  },
  {
    id: "booking",
    icon: "📅",
    titleEs: "Sistemas de Reservas",
    titleEn: "Booking Systems",
    descEs: "Pagos integrados con Wompi/Stripe",
    descEn: "Integrated payments with Wompi/Stripe",
    detailEs:
      "Plataformas de reservas completas con pagos integrados (Wompi, Stripe, Nequi), confirmación automática, recordatorios, y gestión de no-shows.",
    detailEn:
      "Complete booking platforms with integrated payments (Wompi, Stripe, Nequi), automatic confirmation, reminders, and no-show management.",
    color: "#8b5cf6",
  },
  {
    id: "analytics",
    icon: "📊",
    titleEs: "Analítica Avanzada",
    titleEn: "Advanced Analytics",
    descEs: "Dashboards en tiempo real",
    descEn: "Real-time dashboards",
    detailEs:
      "Dashboards ejecutivos con métricas de conversión, ROI, y comportamiento del cliente. Alertas automáticas y reportes programados.",
    detailEn:
      "Executive dashboards with conversion metrics, ROI, and customer behavior. Automatic alerts and scheduled reports.",
    color: "#f97316",
  },
  {
    id: "multilang",
    icon: "🌐",
    titleEs: "Multilenguaje",
    titleEn: "Multi-Language",
    descEs: "Español/Inglés nativo",
    descEn: "Native Spanish/English",
    detailEs:
      "Soporte bilingüe completo con detección automática de idioma. Traducciones profesionales, no automáticas. Perfecto para mercados internacionales.",
    detailEn:
      "Complete bilingual support with automatic language detection. Professional translations, not automated. Perfect for international markets.",
    color: "#0ea5e9",
  },
  {
    id: "security",
    icon: "🔒",
    titleEs: "Seguridad Enterprise",
    titleEn: "Enterprise Security",
    descEs: "RLS, cifrado E2E, compliance",
    descEn: "RLS, E2E encryption, compliance",
    detailEs:
      "Row Level Security en cada tabla, autenticación robusta, cifrado de extremo a extremo. Cumplimiento con estándares de protección de datos.",
    detailEn:
      "Row Level Security on every table, robust authentication, end-to-end encryption. Compliance with data protection standards.",
    color: "#22c55e",
  },
];

export default function CapabilitiesGrid() {
  const language = useLanguage();
  const [expanded, setExpanded] = useState<string | null>(null);

  const title = language === "es" ? "Capacidades" : "Capabilities";
  const subtitle =
    language === "es"
      ? "Tecnología de clase mundial para negocios latinoamericanos"
      : "World-class technology for Latin American businesses";

  return (
    <section className="section-padding bg-[rgba(0,0,0,0.2)]">
      <div className="container-luxury">
        {/* Header - Cinema Engine text animations */}
        <RevealOnScroll direction="up" className="text-center mb-8 md:mb-16">
          <h2
            className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4"
            data-text="slide-up"
          >
            {title}
          </h2>
          <p className="text-muted text-base md:text-lg" data-velocity="skew">
            {subtitle}
          </p>
          <div className="gold-line w-24 mx-auto mt-6" />
        </RevealOnScroll>

        {/* Mobile: List view, Desktop: Hexagonal Grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 max-w-5xl mx-auto"
          data-reveal
        >
          {capabilities.map((cap, index) => {
            const capTitle = language === "es" ? cap.titleEs : cap.titleEn;
            const desc = language === "es" ? cap.descEs : cap.descEn;
            const detail = language === "es" ? cap.detailEs : cap.detailEn;
            const isExpanded = expanded === cap.id;

            return (
              <div key={cap.id} data-reveal-item>
                <RevealOnScroll direction="up" delay={index * 0.1}>
                  <motion.button
                    onClick={() => setExpanded(isExpanded ? null : cap.id)}
                    className="relative w-full min-h-[120px] sm:min-h-0 sm:aspect-square p-4 sm:p-6
                               border border-[var(--mm-border)]
                               bg-[rgba(15,15,26,0.8)]
                               transition-all duration-300
                               hover:border-[var(--mm-border-hover)]
                               text-left sm:text-center
                               flex sm:block items-center gap-4"
                    style={{
                      clipPath:
                        typeof window !== "undefined" && window.innerWidth >= 640
                          ? "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"
                          : "none",
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Glow effect */}
                    <div
                      className="absolute inset-0 opacity-20 transition-opacity duration-300"
                      style={{
                        background: `radial-gradient(circle at center, ${cap.color} 0%, transparent 70%)`,
                      }}
                    />

                    {/* Mobile: Horizontal layout */}
                    <div className="relative z-10 flex sm:flex-col items-center sm:justify-center sm:h-full gap-3 sm:gap-0">
                      <span className="text-2xl sm:text-3xl md:text-4xl sm:mb-3 flex-shrink-0">
                        {cap.icon}
                      </span>
                      <div className="sm:text-center">
                        <h3 className="font-heading text-base sm:text-lg font-semibold text-white sm:mb-2">
                          {capTitle}
                        </h3>
                        <p className="text-muted text-xs sm:text-xs">{desc}</p>
                      </div>
                    </div>

                    {/* Expand indicator for mobile */}
                    <div className="sm:hidden ml-auto flex-shrink-0">
                      <motion.span
                        className="text-[var(--mm-blue-core)] text-xl"
                        animate={{ rotate: isExpanded ? 45 : 0 }}
                      >
                        +
                      </motion.span>
                    </div>
                  </motion.button>

                  {/* Expanded detail panel */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-2 sm:mt-4 p-4 sm:p-6 border border-[var(--mm-border)] bg-[rgba(15,15,26,0.9)]"
                      >
                        <p className="text-muted text-sm leading-relaxed">
                          {detail}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </RevealOnScroll>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

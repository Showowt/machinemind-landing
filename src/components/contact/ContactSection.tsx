"use client";

import { useLanguage } from "@/store/portfolio";
import { motion } from "framer-motion";

export default function ContactSection() {
  const language = useLanguage();

  const content = {
    es: {
      badge: "Sin compromiso",
      title: "15 Minutos que Pueden Cambiar tu Negocio",
      subtitle:
        "Descubre cuánto estás perdiendo en reservas no atendidas y cómo recuperarlo con IA.",
      cta: "Agendar Llamada Gratis",
      stats: [
        { value: "$2,400+", label: "Pérdida mensual promedio" },
        { value: "4-8x", label: "ROI típico" },
        { value: "24/7", label: "Respuesta instantánea" },
      ],
      benefits: [
        "Análisis gratuito de tu situación actual",
        "Cálculo exacto de ingresos perdidos",
        "Demo personalizada de Sofia AI",
        "Plan de implementación sin compromiso",
      ],
      alternative: "¿Prefieres escribirnos?",
      whatsapp: "WhatsApp",
      email: "Email",
    },
    en: {
      badge: "No commitment",
      title: "15 Minutes That Can Transform Your Business",
      subtitle:
        "Discover how much you're losing from missed inquiries and how AI can recover it.",
      cta: "Book Free Strategy Call",
      stats: [
        { value: "$2,400+", label: "Avg monthly loss" },
        { value: "4-8x", label: "Typical ROI" },
        { value: "24/7", label: "Instant response" },
      ],
      benefits: [
        "Free analysis of your current situation",
        "Exact calculation of lost revenue",
        "Personalized Sofia AI demo",
        "No-commitment implementation plan",
      ],
      alternative: "Prefer to message us?",
      whatsapp: "WhatsApp",
      email: "Email",
    },
  };

  const t = content[language];

  return (
    <section id="contact" className="section-padding">
      <div className="container-luxury">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-6"
          >
            <span className="inline-flex items-center px-4 py-2 text-sm font-mono uppercase tracking-wider border border-[var(--mm-border)] text-[var(--mm-blue-core)]">
              <span className="w-2 h-2 bg-[var(--mm-healthy)] mr-2 animate-pulse" />
              {t.badge}
            </span>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-center mb-12"
          >
            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              {t.title}
            </h2>
            <p className="text-muted text-lg max-w-2xl mx-auto">{t.subtitle}</p>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-8 mb-12"
          >
            {t.stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-lg sm:text-2xl md:text-4xl font-bold text-[var(--mm-blue-core)] font-heading">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-muted mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Main CTA Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="border border-[var(--mm-border)] bg-[rgba(15,15,26,0.8)] p-6 md:p-10"
          >
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Benefits */}
              <div>
                <h3 className="font-heading text-xl md:text-2xl font-semibold text-white mb-6">
                  {language === "es" ? "En esta llamada:" : "In this call:"}
                </h3>
                <ul className="space-y-4">
                  {t.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 bg-[var(--mm-blue-core)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg
                          className="w-3 h-3 text-[var(--mm-background)]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                      <span className="text-white">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="text-center">
                <a
                  href="https://cal.com/machine-mind/machinemind-strategy-session"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full md:w-auto min-h-[64px] px-10 py-4 bg-[var(--mm-blue-core)] text-[var(--mm-background)] font-bold text-lg transition-all duration-200 hover:bg-[var(--mm-blue-bright)] hover:scale-105"
                >
                  <svg
                    className="w-6 h-6 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {t.cta}
                </a>

                <p className="text-muted text-sm mt-4">
                  {language === "es"
                    ? "Llamada de 15 min • 100% gratis • Sin presión"
                    : "15 min call • 100% free • No pressure"}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Alternative Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center"
          >
            <p className="text-muted mb-4">{t.alternative}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://wa.me/19544451638?text=Hola%2C%20me%20interesa%20saber%20m%C3%A1s%20sobre%20MachineMind"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--mm-border)] text-white hover:border-[#25D366] hover:text-[#25D366] transition-colors min-h-[48px]"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {t.whatsapp}
              </a>
              <a
                href="mailto:hello@machinemind.ai"
                className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--mm-border)] text-white hover:border-[var(--mm-blue-core)] hover:text-[var(--mm-blue-core)] transition-colors min-h-[48px]"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                {t.email}
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useLanguage } from "@/store/portfolio";
import { RevealOnScroll, CountUp } from "@/components/animation";

interface Differentiator {
  icon: string;
  titleEs: string;
  titleEn: string;
  descEs: string;
  descEn: string;
}

const differentiators: Differentiator[] = [
  {
    icon: "🔄",
    titleEs: "Arquitectura Autopoiética",
    titleEn: "Autopoietic Architecture",
    descEs:
      "Sistemas que se mantienen y evolucionan solos. Actualizaciones automáticas, monitoreo 24/7, auto-reparación.",
    descEn:
      "Systems that maintain and evolve themselves. Automatic updates, 24/7 monitoring, self-healing.",
  },
  {
    icon: "🌎",
    titleEs: "Especialistas en LATAM",
    titleEn: "LATAM Specialists",
    descEs:
      "Construido para Cartagena, Medellín, Bogotá. Entendemos el mercado, la cultura, y los métodos de pago locales.",
    descEn:
      "Built for Cartagena, Medellín, Bogotá. We understand the market, culture, and local payment methods.",
  },
  {
    icon: "🏨",
    titleEs: "ADN Hospitalidad",
    titleEn: "Hospitality DNA",
    descEs:
      "+50K conversaciones IA en hoteles y restaurantes. Sabemos lo que funciona en este sector.",
    descEn:
      "+50K AI conversations in hotels and restaurants. We know what works in this sector.",
  },
  {
    icon: "🚀",
    titleEs: "Entrega Full-Stack",
    titleEn: "Full-Stack Delivery",
    descEs:
      "Del diseño al despliegue en semanas, no meses. Un solo equipo, sin tercerización.",
    descEn:
      "From design to deployment in weeks, not months. One team, no outsourcing.",
  },
  {
    icon: "📈",
    titleEs: "Obsesionados con ROI",
    titleEn: "ROI Obsessed",
    descEs:
      "Medimos lo que importa: ingresos recuperados, conversiones, ahorro de tiempo. No métricas vanidad.",
    descEn:
      "We measure what matters: recovered revenue, conversions, time savings. Not vanity metrics.",
  },
  {
    icon: "🌐",
    titleEs: "IA Bilingüe 24/7",
    titleEn: "24/7 Bilingual AI",
    descEs:
      "Cambio seamless español/inglés. Respuestas naturales, no robóticas. Siempre disponible.",
    descEn:
      "Seamless Spanish/English switching. Natural responses, not robotic. Always available.",
  },
];

export default function WhyMachineMind() {
  const language = useLanguage();

  const title =
    language === "es" ? "¿Por qué MachineMind?" : "Why MachineMind?";
  const subtitle =
    language === "es"
      ? "Lo que nos hace diferentes"
      : "What makes us different";

  return (
    <section className="section-padding">
      <div className="container-luxury">
        {/* Header */}
        <RevealOnScroll direction="up" className="text-center mb-16">
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-muted text-lg">{subtitle}</p>
          <div className="gold-line w-24 mx-auto mt-6" />
        </RevealOnScroll>

        {/* Stats row */}
        <RevealOnScroll direction="up" delay={0.2} className="mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-gold mb-2">
                <CountUp end={31} suffix="+" />
              </div>
              <div className="text-muted text-sm uppercase tracking-wider">
                {language === "es" ? "Proyectos" : "Projects"}
              </div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-gold mb-2">
                <CountUp end={50} suffix="K+" />
              </div>
              <div className="text-muted text-sm uppercase tracking-wider">
                {language === "es" ? "Conversaciones IA" : "AI Conversations"}
              </div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-gold mb-2">
                <CountUp end={99} suffix="%" decimals={1} />
              </div>
              <div className="text-muted text-sm uppercase tracking-wider">
                {language === "es" ? "Uptime" : "Uptime"}
              </div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-gold mb-2">
                <CountUp end={6} />
              </div>
              <div className="text-muted text-sm uppercase tracking-wider">
                {language === "es" ? "Semanas promedio" : "Average Weeks"}
              </div>
            </div>
          </div>
        </RevealOnScroll>

        {/* Differentiators grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {differentiators.map((diff, index) => (
            <RevealOnScroll key={index} direction="up" delay={0.1 * index}>
              <div
                className="p-8 border border-[var(--mm-border)]
                           bg-[rgba(15,15,26,0.6)]
                           transition-all duration-300
                           hover:border-[var(--mm-border-hover)]
                           hover:-translate-y-1"
              >
                <span className="text-4xl mb-4 block">{diff.icon}</span>
                <h3 className="font-heading text-xl font-semibold text-white mb-3">
                  {language === "es" ? diff.titleEs : diff.titleEn}
                </h3>
                <p className="text-muted text-sm leading-relaxed">
                  {language === "es" ? diff.descEs : diff.descEn}
                </p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useLanguage } from "@/store/portfolio";
import { RevealOnScroll, CountUp } from "@/components/animation";
import {
  getActiveProjectCount,
  getProjectsWithLiveUrl,
} from "@/lib/projects-data";

export default function LiveMetrics() {
  const language = useLanguage();

  const metrics = [
    {
      value: getActiveProjectCount(),
      labelEs: "Proyectos Activos",
      labelEn: "Active Projects",
      icon: "📦",
    },
    {
      value: getProjectsWithLiveUrl().length,
      labelEs: "En Producción",
      labelEn: "In Production",
      icon: "🚀",
    },
    {
      value: 50000,
      labelEs: "Conversaciones IA",
      labelEn: "AI Conversations",
      icon: "💬",
      suffix: "+",
    },
    {
      value: 99.9,
      labelEs: "Uptime",
      labelEn: "Uptime",
      icon: "⚡",
      suffix: "%",
      decimals: 1,
    },
  ];

  const title = language === "es" ? "Sistema en Vivo" : "Live System";
  const subtitle =
    language === "es"
      ? "Métricas actualizadas en tiempo real"
      : "Real-time updated metrics";

  return (
    <section className="py-16 border-y border-[var(--mm-gold)] border-opacity-20">
      <div className="container-luxury">
        <RevealOnScroll direction="up" className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="w-2 h-2 bg-[var(--mm-healthy)] animate-pulse" />
            <span
              className="text-gold text-sm font-medium uppercase tracking-wider"
              data-text="scramble"
            >
              {title}
            </span>
            <span className="w-2 h-2 bg-[var(--mm-healthy)] animate-pulse" />
          </div>
          <p className="text-muted text-sm">{subtitle}</p>
        </RevealOnScroll>

        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto"
          data-reveal
        >
          {metrics.map((metric, index) => (
            <div key={index} data-reveal-item>
              <RevealOnScroll
                direction="up"
                delay={index * 0.1}
                className="text-center"
              >
                <div className="text-3xl mb-2">{metric.icon}</div>
                <div
                  className="text-3xl md:text-4xl font-bold text-white mb-1"
                  data-velocity="stretch"
                >
                  <CountUp
                    end={metric.value}
                    suffix={metric.suffix || ""}
                    decimals={metric.decimals || 0}
                  />
                </div>
                <div className="text-muted text-sm">
                  {language === "es" ? metric.labelEs : metric.labelEn}
                </div>
              </RevealOnScroll>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

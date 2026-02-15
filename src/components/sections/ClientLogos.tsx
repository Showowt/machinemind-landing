"use client";

import { useLanguage } from "@/store/portfolio";
import { RevealOnScroll } from "@/components/animation";

// Client logo data (placeholder for real logos)
const clients = [
  { name: "Four Seasons", category: "hotel" },
  { name: "Movvia", category: "hospitality" },
  { name: "Osaka Nikkei", category: "restaurant" },
  { name: "100 Luxury", category: "hospitality" },
  { name: "AeroTransfer", category: "transport" },
  { name: "BenzDriver", category: "transport" },
  { name: "Medellín VIP", category: "tourism" },
  { name: "BlackSound", category: "nightlife" },
];

export default function ClientLogos() {
  const language = useLanguage();

  const title =
    language === "es"
      ? "Confiado por marcas líderes"
      : "Trusted by leading brands";

  return (
    <section className="py-16 border-y border-[var(--mm-border)] bg-[rgba(0,0,0,0.2)]">
      <div className="container-luxury">
        <RevealOnScroll direction="up">
          <p className="text-center text-muted text-sm uppercase tracking-wider mb-8">
            {title}
          </p>
        </RevealOnScroll>

        {/* Infinite scroll container */}
        <div className="relative overflow-hidden">
          {/* Gradient masks */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--mm-background)] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--mm-background)] to-transparent z-10" />

          {/* Scrolling logos */}
          <div className="flex client-logos-scroll">
            {/* First set */}
            {clients.map((client, i) => (
              <div key={`a-${i}`} className="flex-shrink-0 px-8 py-4 group">
                <div className="text-xl font-heading font-semibold text-muted transition-all duration-300 group-hover:text-gold">
                  {client.name}
                </div>
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {clients.map((client, i) => (
              <div key={`b-${i}`} className="flex-shrink-0 px-8 py-4 group">
                <div className="text-xl font-heading font-semibold text-muted transition-all duration-300 group-hover:text-gold">
                  {client.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

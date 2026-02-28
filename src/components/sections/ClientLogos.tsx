"use client";

import { useLanguage } from "@/store/portfolio";
import { RevealOnScroll } from "@/components/animation";

// Real client names from MachineMind portfolio
const clients = [
  { name: "Four Seasons Bogotá", category: "hotel" },
  { name: "Movvia", category: "hospitality" },
  { name: "Dharma Beach Club", category: "hospitality" },
  { name: "Simmer Down Pizza", category: "restaurant" },
  { name: "SEVEN 7 TIMES", category: "nightlife" },
  { name: "World Lion Tours", category: "tourism" },
  { name: "LA KASTA Premium", category: "restaurant" },
  { name: "Osaka Nikkei", category: "restaurant" },
  { name: "Libertario Coffee", category: "restaurant" },
  { name: "Alambique Medellín", category: "restaurant" },
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
              <div
                key={`a-${i}`}
                className="flex-shrink-0 px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 group"
              >
                <div className="text-base sm:text-lg md:text-xl font-heading font-semibold text-muted transition-all duration-300 group-hover:text-gold">
                  {client.name}
                </div>
              </div>
            ))}
            {/* Duplicate for seamless loop */}
            {clients.map((client, i) => (
              <div
                key={`b-${i}`}
                className="flex-shrink-0 px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 group"
              >
                <div className="text-base sm:text-lg md:text-xl font-heading font-semibold text-muted transition-all duration-300 group-hover:text-gold">
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

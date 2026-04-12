"use client";

import { useEffect, useRef, useState } from "react";
import CinemaEngine, {
  CinemaText,
  CinemaReveal,
  CinemaRevealItem,
  MagneticButton,
} from "@/components/cinema/CinemaEngine";

// ═══════════════════════════════════════════════════════════════
// STEFFANO'S BISTRO — CARTAGENA
// Cinema Engine Demo Build
// ═══════════════════════════════════════════════════════════════

const WHATSAPP_NUMBER = "573001234567";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Hola, me gustaría hacer una reservación en Steffano's Bistro."
);

// Menu data
const menuHighlights = [
  {
    name: "Beef Short Ribs",
    description: "Costillas de res braseadas 8 horas, reducción de vino tinto, puré trufado",
    price: "$89.000",
  },
  {
    name: "Crab Risotto",
    description: "Risotto cremoso con cangrejo de la costa, azafrán y parmesano 24 meses",
    price: "$78.000",
  },
  {
    name: "French Onion Soup",
    description: "Sopa de cebolla caramelizada, gratinada con gruyère y croutons de brioche",
    price: "$38.000",
  },
  {
    name: "Salmon Filet",
    description: "Salmón del Atlántico, costra de hierbas, beurre blanc, vegetales de temporada",
    price: "$72.000",
  },
];

const hours = [
  { day: "Lunes", time: "4:00 PM - 9:00 PM" },
  { day: "Martes", time: "Cerrado" },
  { day: "Miércoles", time: "4:00 PM - 9:00 PM" },
  { day: "Jueves", time: "4:00 PM - 9:00 PM" },
  { day: "Viernes", time: "4:00 PM - 9:30 PM" },
  { day: "Sábado", time: "4:00 PM - 9:30 PM" },
  { day: "Domingo", time: "4:00 PM - 9:30 PM" },
];

export default function StefanosBistroPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <CinemaEngine accentColor="#c9a96e" />

      {/* ═══════════════════════════════════════════════════════════════
          HEADER — Fixed Navigation
          ═══════════════════════════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="#" className="font-instrument text-2xl text-[var(--accent)]">
            Steffano&apos;s
          </a>
          <nav className="hidden md:flex items-center gap-10">
            <a href="#menu" className="nav-link">
              Menú
            </a>
            <a href="#chef" className="nav-link">
              El Chef
            </a>
            <a href="#reservations" className="nav-link">
              Reservaciones
            </a>
          </nav>
          <MagneticButton
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
            className="btn-hero text-xs px-6 py-3"
            strength={0.2}
          >
            Reservar
          </MagneticButton>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#06060a] via-[#0a0a0f] to-[#06060a]" />

        {/* Animated background circles */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-10"
            style={{
              background:
                "radial-gradient(circle, rgba(201,169,110,0.3) 0%, transparent 70%)",
              animation: "pulse 8s ease-in-out infinite",
            }}
          />
          <div
            className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full opacity-10"
            style={{
              background:
                "radial-gradient(circle, rgba(201,169,110,0.2) 0%, transparent 70%)",
              animation: "pulse 10s ease-in-out infinite 2s",
            }}
          />
        </div>

        {/* Hero content */}
        <div
          className={`relative z-10 text-center px-6 transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <p className="eyebrow mb-6" data-text="scramble">
            Cartagena de Indias
          </p>

          <h1 className="font-clash text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-6">
            <CinemaText effect="slide-up">
              <span className="block">Steffano&apos;s</span>
            </CinemaText>
            <CinemaText effect="slide-up">
              <span className="font-instrument text-[var(--accent)] block mt-2">
                Bistro
              </span>
            </CinemaText>
          </h1>

          <p
            className="text-[var(--dim)] text-lg md:text-xl max-w-xl mx-auto mb-10 font-satoshi"
            data-text="scroll-fade"
          >
            Cocina italiana y francesa con autenticidad y pasión.
            Más de 40 años de excelencia culinaria.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MagneticButton
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
              className="btn-hero"
              strength={0.3}
            >
              Reservar Mesa
            </MagneticButton>
            <MagneticButton
              href="#menu"
              className="btn-hero border-[var(--glass-border)]"
              strength={0.3}
            >
              Ver Menú
            </MagneticButton>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
            <span className="text-[9px] tracking-[0.3em] uppercase text-[var(--dim)]">
              Scroll
            </span>
            <div className="scroll-indicator-line" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          STATS STRIP
          ═══════════════════════════════════════════════════════════════ */}
      <section className="border-y border-[var(--glass-border)]">
        <div className="max-w-7xl mx-auto">
          <CinemaReveal className="grid grid-cols-2 md:grid-cols-4">
            <CinemaRevealItem>
              <div className="stat-item">
                <p className="font-clash text-4xl md:text-5xl text-[var(--accent)]">
                  40+
                </p>
                <p className="text-[var(--dim)] text-sm mt-2 uppercase tracking-wider">
                  Años de Experiencia
                </p>
              </div>
            </CinemaRevealItem>
            <CinemaRevealItem>
              <div className="stat-item">
                <p className="font-clash text-4xl md:text-5xl text-[var(--accent)]">
                  2
                </p>
                <p className="text-[var(--dim)] text-sm mt-2 uppercase tracking-wider">
                  Cocinas Fusionadas
                </p>
              </div>
            </CinemaRevealItem>
            <CinemaRevealItem>
              <div className="stat-item">
                <p className="font-clash text-4xl md:text-5xl text-[var(--accent)]">
                  100%
                </p>
                <p className="text-[var(--dim)] text-sm mt-2 uppercase tracking-wider">
                  Ingredientes Premium
                </p>
              </div>
            </CinemaRevealItem>
            <CinemaRevealItem>
              <div className="stat-item">
                <p className="font-clash text-4xl md:text-5xl text-[var(--accent)]">
                  ★ 4.9
                </p>
                <p className="text-[var(--dim)] text-sm mt-2 uppercase tracking-wider">
                  Calificación
                </p>
              </div>
            </CinemaRevealItem>
          </CinemaReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          MENU SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section id="menu" className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow mb-4">Nuestra Carta</p>
            <h2 className="font-clash text-4xl md:text-5xl font-medium">
              <CinemaText effect="slide-up">Platos Destacados</CinemaText>
            </h2>
          </div>

          <CinemaReveal>
            <div className="space-y-1">
              {menuHighlights.map((item, index) => (
                <CinemaRevealItem key={index}>
                  <div className="group py-8 border-b border-[var(--glass-border)] flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--glass)] transition-colors px-4 -mx-4">
                    <div className="flex-1">
                      <h3 className="font-clash text-xl md:text-2xl mb-2 group-hover:text-[var(--accent)] transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-[var(--dim)] text-sm md:text-base">
                        {item.description}
                      </p>
                    </div>
                    <p className="font-clash text-2xl text-[var(--accent)] shrink-0">
                      {item.price}
                    </p>
                  </div>
                </CinemaRevealItem>
              ))}
            </div>
          </CinemaReveal>

          <div className="text-center mt-12">
            <MagneticButton
              href="#reservations"
              className="btn-hero"
              strength={0.3}
            >
              Ver Menú Completo
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          CHEF SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="chef"
        className="py-24 md:py-32 px-6 bg-[var(--glass)] border-y border-[var(--glass-border)]"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            {/* Chef image placeholder */}
            <CinemaReveal variant="clip">
              <div className="aspect-[4/5] bg-gradient-to-br from-[var(--glass)] to-[#0a0a0f] border border-[var(--glass-border)] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full bg-[var(--glass-border)] mx-auto mb-6 flex items-center justify-center">
                    <span className="font-instrument text-4xl text-[var(--accent)]">
                      SN
                    </span>
                  </div>
                  <p className="text-[var(--dim)] text-sm uppercase tracking-wider">
                    Executive Chef
                  </p>
                </div>
              </div>
            </CinemaReveal>

            {/* Chef bio */}
            <div>
              <p className="eyebrow mb-4">El Maestro</p>
              <h2 className="font-clash text-4xl md:text-5xl font-medium mb-6">
                <CinemaText effect="slide-up">Chef Stephen Ng</CinemaText>
              </h2>
              <div className="space-y-6 text-[var(--dim)]" data-reveal="">
                <p data-reveal-item="">
                  Con más de <span className="text-[var(--fg)]">40 años de experiencia culinaria</span>,
                  el Chef Stephen Ng ha dedicado su vida a perfeccionar el arte de la
                  cocina italiana y francesa.
                </p>
                <p data-reveal-item="">
                  Su filosofía es simple: ingredientes de la más alta calidad,
                  técnicas tradicionales y una pasión inquebrantable por crear
                  experiencias gastronómicas <span className="font-instrument text-[var(--accent)]">inolvidables</span>.
                </p>
                <p data-reveal-item="">
                  Cada plato en Steffano&apos;s es una obra de arte que cuenta la historia
                  de décadas de dedicación y amor por la cocina.
                </p>
              </div>
              <div className="mt-8">
                <p className="text-sm text-[var(--accent)] font-clash">
                  &quot;La cocina no es solo alimentar el cuerpo,
                  es nutrir el alma.&quot;
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          AMBIANCE SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow mb-4">La Experiencia</p>
            <h2 className="font-clash text-4xl md:text-5xl font-medium mb-6">
              <CinemaText effect="slide-up">Un Ambiente Único</CinemaText>
            </h2>
            <p
              className="text-[var(--dim)] text-lg max-w-2xl mx-auto"
              data-text="scroll-fade"
            >
              Ya sea una cena romántica, una celebración familiar o una reunión casual,
              Steffano&apos;s Bistro ofrece el escenario perfecto para momentos memorables.
            </p>
          </div>

          <CinemaReveal>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: "Cenas Románticas",
                  desc: "Iluminación íntima y ambiente acogedor para dos",
                  icon: "♥",
                },
                {
                  title: "Celebraciones",
                  desc: "Espacio versátil para reuniones familiares especiales",
                  icon: "★",
                },
                {
                  title: "Reuniones Casuales",
                  desc: "El lugar perfecto para ponerse al día con amigos",
                  icon: "◆",
                },
              ].map((item, index) => (
                <CinemaRevealItem key={index}>
                  <div className="capability-card h-full">
                    <span className="text-3xl text-[var(--accent)] block mb-4">
                      {item.icon}
                    </span>
                    <h3 className="font-clash text-xl mb-3">{item.title}</h3>
                    <p className="text-[var(--dim)] text-sm">{item.desc}</p>
                  </div>
                </CinemaRevealItem>
              ))}
            </div>
          </CinemaReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          HOURS & LOCATION
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="reservations"
        className="py-24 md:py-32 px-6 bg-[var(--glass)] border-y border-[var(--glass-border)]"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20">
            {/* Hours */}
            <CinemaReveal>
              <div>
                <p className="eyebrow mb-4">Horario</p>
                <h2 className="font-clash text-3xl md:text-4xl font-medium mb-8">
                  Horas de Atención
                </h2>
                <div className="space-y-3">
                  {hours.map((item, index) => (
                    <CinemaRevealItem key={index}>
                      <div
                        className={`flex justify-between py-3 border-b border-[var(--glass-border)] ${
                          item.time === "Cerrado" ? "opacity-50" : ""
                        }`}
                      >
                        <span className="text-[var(--dim)]">{item.day}</span>
                        <span
                          className={
                            item.time === "Cerrado"
                              ? "text-[var(--dim)]"
                              : "text-[var(--fg)]"
                          }
                        >
                          {item.time}
                        </span>
                      </div>
                    </CinemaRevealItem>
                  ))}
                </div>
              </div>
            </CinemaReveal>

            {/* Contact & Location */}
            <CinemaReveal>
              <div>
                <p className="eyebrow mb-4">Ubicación</p>
                <h2 className="font-clash text-3xl md:text-4xl font-medium mb-8">
                  Visítanos
                </h2>
                <div className="space-y-6">
                  <CinemaRevealItem>
                    <div>
                      <p className="text-[var(--dim)] text-sm uppercase tracking-wider mb-2">
                        Dirección
                      </p>
                      <p className="text-lg">
                        Calle del Arsenal #8B-42
                        <br />
                        Centro Histórico, Cartagena
                      </p>
                    </div>
                  </CinemaRevealItem>
                  <CinemaRevealItem>
                    <div>
                      <p className="text-[var(--dim)] text-sm uppercase tracking-wider mb-2">
                        Teléfono
                      </p>
                      <p className="text-lg">+57 300 123 4567</p>
                    </div>
                  </CinemaRevealItem>
                  <CinemaRevealItem>
                    <div>
                      <p className="text-[var(--dim)] text-sm uppercase tracking-wider mb-2">
                        Email
                      </p>
                      <p className="text-lg">reservas@stefanosbistro.co</p>
                    </div>
                  </CinemaRevealItem>
                </div>

                <div className="mt-10">
                  <MagneticButton
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
                    className="btn-hero w-full justify-center"
                    strength={0.2}
                  >
                    <svg
                      className="w-5 h-5 mr-3"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Reservar por WhatsApp
                  </MagneticButton>
                </div>
              </div>
            </CinemaReveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════ */}
      <footer className="py-16 px-6 border-t border-[var(--glass-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <p className="font-instrument text-2xl text-[var(--accent)] mb-2">
                Steffano&apos;s Bistro
              </p>
              <p className="text-[var(--dim)] text-sm">
                Cocina Italiana & Francesa • Cartagena de Indias
              </p>
            </div>
            <div className="flex items-center gap-8">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--dim)] hover:text-[var(--accent)] transition-colors"
              >
                Instagram
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--dim)] hover:text-[var(--accent)] transition-colors"
              >
                Facebook
              </a>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--dim)] hover:text-[var(--accent)] transition-colors"
              >
                WhatsApp
              </a>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-[var(--glass-border)] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[var(--dim)] text-xs">
              © {new Date().getFullYear()} Steffano&apos;s Bistro. Todos los derechos reservados.
            </p>
            <p className="text-[var(--dim)] text-xs">
              Desarrollado por{" "}
              <a
                href="https://machinemindconsulting.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                MachineMind
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Keyframe animation */}
      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.15;
          }
        }
      `}</style>
    </>
  );
}

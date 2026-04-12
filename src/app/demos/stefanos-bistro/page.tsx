"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import CinemaEngine, {
  CinemaText,
  CinemaReveal,
  CinemaRevealItem,
  MagneticButton,
} from "@/components/cinema/CinemaEngine";

// ═══════════════════════════════════════════════════════════════
// STEFANO'S BISTRO — CARTAGENA
// $500K Masterpiece Build — Cinema Engine APEX
// ═══════════════════════════════════════════════════════════════

const WHATSAPP_NUMBER = "573001234567";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Hola, me gustaría hacer una reservación en Stefano's Bistro."
);

// Brand colors extracted from logo
const BRAND = {
  sage: "#a3a88c",
  sageLight: "#c5c9b4",
  sageDark: "#7a7f68",
  cream: "#f5f4ef",
  charcoal: "#1a1a1a",
};

// Menu data with real dishes
const menuHighlights = [
  {
    name: "Pecan Crusted Fish",
    nameSp: "Pescado con Costra de Nuez",
    description: "Atlantic fish with toasted pecan crust, roasted vegetables, and beurre blanc",
    descriptionSp: "Pescado del Atlántico con costra de nuez tostada, vegetales asados y beurre blanc",
    price: "$89.000",
    image: "/demos/stefanos-bistro/food-fish.jpg",
  },
  {
    name: "Signature Burger",
    nameSp: "Hamburguesa Signature",
    description: "Brioche bun, thick-cut bacon, house sauce, served with truffle fries",
    descriptionSp: "Pan brioche, tocino grueso, salsa de la casa, con papas trufadas",
    price: "$68.000",
    image: "/demos/stefanos-bistro/food-burger.jpg",
  },
];

const hours = [
  { day: "Lunes", time: "4:00 PM - 9:00 PM" },
  { day: "Martes", time: "Cerrado", closed: true },
  { day: "Miércoles", time: "4:00 PM - 9:00 PM" },
  { day: "Jueves", time: "4:00 PM - 9:00 PM" },
  { day: "Viernes", time: "4:00 PM - 9:30 PM" },
  { day: "Sábado", time: "4:00 PM - 9:30 PM" },
  { day: "Domingo", time: "4:00 PM - 9:30 PM" },
];

export default function StefanosBistroPage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Rotate menu items
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMenuItem((prev) => (prev + 1) % menuHighlights.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#06060a] min-h-screen overflow-x-hidden">
      <CinemaEngine accentColor={BRAND.sage} />

      {/* Custom styles for this page */}
      <style jsx global>{`
        :root {
          --brand-sage: ${BRAND.sage};
          --brand-sage-light: ${BRAND.sageLight};
          --brand-sage-dark: ${BRAND.sageDark};
          --brand-cream: ${BRAND.cream};
        }

        .btn-sage {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid ${BRAND.sage};
          background: transparent;
          padding: 16px 40px;
          font-size: 11px;
          font-family: var(--font-satoshi);
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: ${BRAND.cream};
          overflow: hidden;
          transition: color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }

        .btn-sage::before {
          content: '';
          position: absolute;
          left: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          background: ${BRAND.sage};
          transform: translateY(101%);
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: -1;
        }

        .btn-sage:hover::before {
          transform: translateY(0);
        }

        .btn-sage:hover {
          color: #06060a;
        }

        .eyebrow-sage {
          font-size: 10px;
          letter-spacing: 0.4em;
          text-transform: uppercase;
          color: ${BRAND.sage};
        }

        .gradient-sage {
          background: linear-gradient(135deg, ${BRAND.sage} 0%, ${BRAND.sageLight} 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .card-luxury {
          background: rgba(163, 168, 140, 0.03);
          border: 1px solid rgba(163, 168, 140, 0.1);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .card-luxury:hover {
          background: rgba(163, 168, 140, 0.06);
          border-color: rgba(163, 168, 140, 0.2);
        }

        .card-luxury::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, ${BRAND.sage}, transparent);
          transform: scaleX(0);
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .card-luxury:hover::before {
          transform: scaleX(1);
        }

        /* Video overlay gradient */
        .video-overlay {
          background: linear-gradient(
            to bottom,
            rgba(6, 6, 10, 0.3) 0%,
            rgba(6, 6, 10, 0.1) 30%,
            rgba(6, 6, 10, 0.1) 70%,
            rgba(6, 6, 10, 0.95) 100%
          );
        }

        /* Smooth image reveals */
        .image-reveal {
          clip-path: inset(100% 0 0 0);
          transition: clip-path 1.2s cubic-bezier(0.77, 0, 0.175, 1);
        }

        .image-reveal.revealed {
          clip-path: inset(0 0 0 0);
        }

        /* Menu item transitions */
        .menu-image {
          transition: opacity 0.8s ease, transform 0.8s ease;
        }

        /* Parallax container */
        .parallax-container {
          perspective: 1000px;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(163, 168, 140, 0.2); }
          50% { box-shadow: 0 0 80px rgba(163, 168, 140, 0.4); }
        }

        .floating {
          animation: float 6s ease-in-out infinite;
        }

        .glow-pulse {
          animation: pulse-glow 4s ease-in-out infinite;
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          HEADER — Transparent Fixed Navigation
          ═══════════════════════════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-6 mix-blend-difference">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="relative w-14 h-14 md:w-16 md:h-16">
            <Image
              src="/demos/stefanos-bistro/logo.png"
              alt="Stefano's Bistro"
              fill
              className="object-contain"
              priority
            />
          </a>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-12">
            {["Menú", "Historia", "Reservar"].map((item, i) => (
              <a
                key={i}
                href={`#${item.toLowerCase()}`}
                className="text-[11px] tracking-[0.2em] uppercase text-white/40 hover:text-white transition-colors duration-300"
              >
                {item}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <MagneticButton
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
            className="hidden md:flex btn-sage text-xs px-6 py-3"
            strength={0.2}
          >
            Reservar
          </MagneticButton>

          {/* Mobile menu button */}
          <button className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5">
            <span className="w-6 h-px bg-white/60" />
            <span className="w-4 h-px bg-white/60" />
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          HERO — Full-Screen Video with Cinematic Overlay
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            onLoadedData={() => setVideoLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-1000 ${
              videoLoaded ? "opacity-100" : "opacity-0"
            }`}
          >
            <source src="/demos/stefanos-bistro/hero-video.mp4" type="video/mp4" />
          </video>

          {/* Video overlay gradient */}
          <div className="absolute inset-0 video-overlay" />

          {/* Vignette */}
          <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.8)]" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
          <div
            className={`text-center transition-all duration-1500 delay-500 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            }`}
          >
            {/* Logo badge */}
            <div className="mb-8 floating">
              <div className="w-24 h-24 md:w-32 md:h-32 mx-auto relative glow-pulse rounded-full overflow-hidden">
                <Image
                  src="/demos/stefanos-bistro/logo.png"
                  alt="Stefano's Bistro"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Tagline */}
            <p className="eyebrow-sage mb-6" data-text="scramble">
              Cartagena de Indias
            </p>

            {/* Main headline */}
            <h1 className="font-clash text-5xl md:text-7xl lg:text-[120px] font-light tracking-tight leading-[0.9] mb-8">
              <CinemaText effect="slide-up">
                <span className="block text-white">Italian</span>
              </CinemaText>
              <CinemaText effect="slide-up">
                <span className="block gradient-sage">&</span>
              </CinemaText>
              <CinemaText effect="slide-up">
                <span className="block text-white">French</span>
              </CinemaText>
            </h1>

            {/* Subheadline */}
            <p
              className="text-white/50 text-lg md:text-xl max-w-md mx-auto mb-12 font-satoshi font-light"
              data-text="scroll-fade"
            >
              Más de 40 años de excelencia culinaria.
              <br />
              <span className="text-white/30">Autenticidad. Pasión. Arte.</span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <MagneticButton
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
                className="btn-sage"
                strength={0.3}
              >
                Reservar Mesa
              </MagneticButton>
              <MagneticButton
                href="#menu"
                className="btn-sage !border-white/10"
                strength={0.3}
              >
                Explorar Menú
              </MagneticButton>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4">
            <span className="text-[9px] tracking-[0.4em] uppercase text-white/30">
              Scroll
            </span>
            <div className="w-px h-16 bg-gradient-to-b from-white/50 to-transparent" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          PHILOSOPHY — Manifesto Section
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-32 md:py-48 px-6 relative">
        {/* Background accent */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5"
          style={{
            background: `radial-gradient(circle, ${BRAND.sage} 0%, transparent 70%)`,
          }}
        />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <p className="eyebrow-sage mb-8">Nuestra Filosofía</p>

          <blockquote className="font-clash text-3xl md:text-5xl lg:text-6xl font-light leading-tight mb-12">
            <CinemaText effect="scroll-fade">
              <span className="text-white/90">
                &ldquo;La cocina no es solo alimentar el cuerpo,{" "}
                <span className="gradient-sage">es nutrir el alma</span>.&rdquo;
              </span>
            </CinemaText>
          </blockquote>

          <p className="text-white/40 text-sm uppercase tracking-[0.3em]">
            — Chef Stephen Ng
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          MENU — Immersive Food Gallery
          ═══════════════════════════════════════════════════════════════ */}
      <section id="menu" className="py-24 md:py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center mb-20">
            <p className="eyebrow-sage mb-4">Nuestra Carta</p>
            <h2 className="font-clash text-4xl md:text-6xl font-light">
              <CinemaText effect="slide-up">Platos Signature</CinemaText>
            </h2>
          </div>

          {/* Featured dishes - Large immersive cards */}
          <CinemaReveal>
            <div className="space-y-32">
              {menuHighlights.map((item, index) => (
                <CinemaRevealItem key={index}>
                  <div
                    className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center ${
                      index % 2 === 1 ? "md:flex-row-reverse" : ""
                    }`}
                  >
                    {/* Image */}
                    <div
                      className={`relative aspect-[4/3] overflow-hidden ${
                        index % 2 === 1 ? "md:order-2" : ""
                      }`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent z-10" />
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-1000"
                      />
                      {/* Price badge */}
                      <div className="absolute bottom-6 right-6 z-20">
                        <span
                          className="px-4 py-2 text-sm font-clash tracking-wider"
                          style={{ background: BRAND.sage, color: "#06060a" }}
                        >
                          {item.price}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className={index % 2 === 1 ? "md:order-1" : ""}>
                      <span className="eyebrow-sage block mb-4">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-clash text-3xl md:text-4xl font-light mb-2 text-white">
                        {item.name}
                      </h3>
                      <p className="font-instrument text-xl text-white/40 italic mb-6">
                        {item.nameSp}
                      </p>
                      <p className="text-white/60 text-lg leading-relaxed mb-4">
                        {item.description}
                      </p>
                      <p className="text-white/40 text-base leading-relaxed">
                        {item.descriptionSp}
                      </p>
                    </div>
                  </div>
                </CinemaRevealItem>
              ))}
            </div>
          </CinemaReveal>

          {/* CTA */}
          <div className="text-center mt-24">
            <MagneticButton
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
              className="btn-sage"
              strength={0.3}
            >
              Ver Menú Completo
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          STORY — Chef & Restaurant History
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="historia"
        className="py-32 md:py-48 relative overflow-hidden"
        style={{ background: `linear-gradient(to bottom, #06060a, ${BRAND.charcoal}, #06060a)` }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(${BRAND.sage} 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-center">
            {/* Image column */}
            <CinemaReveal variant="clip">
              <div className="relative">
                {/* Main image placeholder with logo */}
                <div className="aspect-[3/4] bg-gradient-to-br from-[rgba(163,168,140,0.1)] to-[rgba(163,168,140,0.02)] flex items-center justify-center border border-white/5">
                  <div className="text-center">
                    <div className="w-40 h-40 mx-auto relative mb-8">
                      <Image
                        src="/demos/stefanos-bistro/logo.png"
                        alt="Stefano's Bistro"
                        fill
                        className="object-contain opacity-80"
                      />
                    </div>
                    <p className="eyebrow-sage">Executive Chef</p>
                    <p className="font-clash text-2xl text-white/80 mt-2">
                      Stephen Ng
                    </p>
                  </div>
                </div>

                {/* Decorative elements */}
                <div
                  className="absolute -bottom-8 -right-8 w-32 h-32 border"
                  style={{ borderColor: `${BRAND.sage}30` }}
                />
                <div
                  className="absolute -top-8 -left-8 w-24 h-24 border"
                  style={{ borderColor: `${BRAND.sage}20` }}
                />
              </div>
            </CinemaReveal>

            {/* Text column */}
            <div>
              <p className="eyebrow-sage mb-6">Nuestra Historia</p>
              <h2 className="font-clash text-4xl md:text-5xl font-light mb-8 text-white">
                <CinemaText effect="slide-up">
                  40 Años de
                  <br />
                  <span className="gradient-sage">Excelencia</span>
                </CinemaText>
              </h2>

              <div className="space-y-6 text-white/50 text-lg leading-relaxed" data-reveal="">
                <p data-reveal-item="">
                  Con más de <span className="text-white">cuatro décadas de experiencia culinaria</span>,
                  el Chef Stephen Ng ha dedicado su vida a perfeccionar el arte de la
                  cocina italiana y francesa.
                </p>
                <p data-reveal-item="">
                  Cada plato es una obra maestra que fusiona{" "}
                  <span className="text-white">técnicas tradicionales</span> con
                  ingredientes de la más alta calidad, creando experiencias
                  gastronómicas <span className="font-instrument italic" style={{ color: BRAND.sage }}>inolvidables</span>.
                </p>
                <p data-reveal-item="">
                  Desde nuestra apertura en 2020, Stefano&apos;s Bistro se ha convertido
                  en el destino preferido para quienes buscan una experiencia
                  culinaria excepcional en el corazón de Cartagena.
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-8 mt-12 pt-12 border-t border-white/10">
                {[
                  { number: "40+", label: "Años" },
                  { number: "2", label: "Cocinas" },
                  { number: "★ 4.9", label: "Rating" },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <p className="font-clash text-3xl md:text-4xl" style={{ color: BRAND.sage }}>
                      {stat.number}
                    </p>
                    <p className="text-white/30 text-xs uppercase tracking-wider mt-2">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          EXPERIENCE — Atmosphere Cards
          ═══════════════════════════════════════════════════════════════ */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="eyebrow-sage mb-4">La Experiencia</p>
            <h2 className="font-clash text-4xl md:text-5xl font-light">
              <CinemaText effect="slide-up">Momentos Memorables</CinemaText>
            </h2>
          </div>

          <CinemaReveal>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: "◇",
                  title: "Cenas Románticas",
                  titleEn: "Romantic Dinners",
                  desc: "Iluminación íntima y ambiente acogedor para momentos especiales a dos.",
                },
                {
                  icon: "✦",
                  title: "Celebraciones",
                  titleEn: "Celebrations",
                  desc: "El escenario perfecto para cumpleaños, aniversarios y reuniones familiares.",
                },
                {
                  icon: "○",
                  title: "Encuentros",
                  titleEn: "Gatherings",
                  desc: "Ambiente versátil para ponerse al día con amigos o colegas.",
                },
              ].map((item, index) => (
                <CinemaRevealItem key={index}>
                  <div className="card-luxury relative p-10 h-full">
                    <span
                      className="text-4xl block mb-6"
                      style={{ color: BRAND.sage }}
                    >
                      {item.icon}
                    </span>
                    <h3 className="font-clash text-2xl mb-1 text-white">
                      {item.title}
                    </h3>
                    <p className="font-instrument text-white/30 italic text-sm mb-4">
                      {item.titleEn}
                    </p>
                    <p className="text-white/50 leading-relaxed">{item.desc}</p>
                  </div>
                </CinemaRevealItem>
              ))}
            </div>
          </CinemaReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          RESERVATIONS — Hours & Contact
          ═══════════════════════════════════════════════════════════════ */}
      <section
        id="reservar"
        className="py-32 relative"
        style={{
          background: `linear-gradient(135deg, rgba(163,168,140,0.05) 0%, transparent 50%)`,
        }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 md:gap-24">
            {/* Hours */}
            <CinemaReveal>
              <div>
                <p className="eyebrow-sage mb-4">Horario</p>
                <h2 className="font-clash text-3xl md:text-4xl font-light mb-10 text-white">
                  Horas de Atención
                </h2>
                <div className="space-y-0">
                  {hours.map((item, index) => (
                    <CinemaRevealItem key={index}>
                      <div
                        className={`flex justify-between py-4 border-b border-white/5 ${
                          item.closed ? "opacity-40" : ""
                        }`}
                      >
                        <span className="text-white/60 font-light">{item.day}</span>
                        <span
                          className={
                            item.closed
                              ? "text-white/30 font-light"
                              : "text-white font-light"
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
                <p className="eyebrow-sage mb-4">Ubicación</p>
                <h2 className="font-clash text-3xl md:text-4xl font-light mb-10 text-white">
                  Visítanos
                </h2>
                <div className="space-y-8">
                  <CinemaRevealItem>
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">
                        Dirección
                      </p>
                      <p className="text-white text-lg font-light">
                        Calle del Arsenal #8B-42
                        <br />
                        Centro Histórico, Cartagena
                      </p>
                    </div>
                  </CinemaRevealItem>
                  <CinemaRevealItem>
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">
                        Teléfono
                      </p>
                      <p className="text-white text-lg font-light">+57 300 123 4567</p>
                    </div>
                  </CinemaRevealItem>
                  <CinemaRevealItem>
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-[0.2em] mb-2">
                        Email
                      </p>
                      <p className="text-white text-lg font-light">
                        reservas@stefanosbistro.co
                      </p>
                    </div>
                  </CinemaRevealItem>
                </div>

                {/* WhatsApp CTA */}
                <div className="mt-12">
                  <MagneticButton
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
                    className="btn-sage w-full justify-center"
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
          FOOTER — Minimal Luxury
          ═══════════════════════════════════════════════════════════════ */}
      <footer className="py-20 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            {/* Logo & tagline */}
            <div className="text-center md:text-left">
              <div className="w-20 h-20 mx-auto md:mx-0 mb-4 relative">
                <Image
                  src="/demos/stefanos-bistro/logo.png"
                  alt="Stefano's Bistro"
                  fill
                  className="object-contain opacity-80"
                />
              </div>
              <p className="text-white/30 text-sm">
                Italian & French Cuisine
                <br />
                Cartagena de Indias
              </p>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-10">
              {["Instagram", "Facebook", "WhatsApp"].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="text-white/30 hover:text-white text-xs uppercase tracking-[0.2em] transition-colors duration-300"
                >
                  {social}
                </a>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/20 text-xs">
              © {new Date().getFullYear()} Stefano&apos;s Bistro. Todos los derechos reservados.
            </p>
            <p className="text-white/20 text-xs">
              Creado por{" "}
              <a
                href="https://machinemindconsulting.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
                style={{ color: BRAND.sage }}
              >
                MachineMind
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

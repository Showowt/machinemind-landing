"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

// ═══════════════════════════════════════════════════════════════
// STEFANO'S BISTRO — CARTAGENA
// Apple/Microsoft/Claude-tier Masterpiece
// Ultra-smooth scroll, parallax depth, orchestrated reveals
// ═══════════════════════════════════════════════════════════════

const WHATSAPP_NUMBER = "573001234567";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Hola, me gustaría hacer una reservación en Stefano's Bistro."
);

// Brand colors
const BRAND = {
  sage: "#a3a88c",
  sageLight: "#c5c9b4",
  sageDark: "#7a7f68",
  cream: "#f5f4ef",
};

// Menu data
const menuHighlights = [
  {
    name: "Pecan Crusted Fish",
    nameSp: "Pescado con Costra de Nuez",
    description: "Atlantic fish, toasted pecan crust, roasted vegetables, beurre blanc",
    price: "$89.000",
    image: "/demos/stefanos-bistro/food-fish.jpg",
  },
  {
    name: "Signature Burger",
    nameSp: "Hamburguesa Signature",
    description: "Brioche bun, thick-cut bacon, house sauce, truffle fries",
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
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Smooth scroll handler
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Mouse tracking for parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Preloader sequence
  useEffect(() => {
    const timer1 = setTimeout(() => setIsLoaded(true), 100);
    const timer2 = setTimeout(() => setPreloaderDone(true), 2000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Intersection Observer for reveals
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.1, rootMargin: "-50px" }
    );

    document.querySelectorAll(".reveal-on-scroll").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [preloaderDone]);

  // Parallax calculation
  const parallax = useCallback((speed: number) => {
    return scrollY * speed;
  }, [scrollY]);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          PRELOADER — Apple-style Logo Reveal
          ═══════════════════════════════════════════════════════════════ */}
      <div
        className={`fixed inset-0 z-[100] bg-[#06060a] flex items-center justify-center transition-all duration-1000 ${
          preloaderDone ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div
          className={`relative transition-all duration-1000 ease-out ${
            isLoaded ? "scale-100 opacity-100" : "scale-90 opacity-0"
          }`}
        >
          <div className="w-32 h-32 md:w-40 md:h-40 relative">
            <Image
              src="/demos/stefanos-bistro/logo.png"
              alt="Stefano's Bistro"
              fill
              className="object-contain"
              priority
            />
          </div>
          {/* Loading ring */}
          <svg
            className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke={BRAND.sage}
              strokeWidth="0.5"
              strokeDasharray="302"
              strokeDashoffset="302"
              className="animate-[dash_1.5s_ease-out_forwards]"
              style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
            />
          </svg>
        </div>
      </div>

      {/* Main Container */}
      <div
        ref={containerRef}
        className={`bg-[#06060a] min-h-screen overflow-x-hidden transition-opacity duration-1000 ${
          preloaderDone ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Global Styles */}
        <style jsx global>{`
          @keyframes dash {
            to {
              stroke-dashoffset: 0;
            }
          }

          html {
            scroll-behavior: smooth;
          }

          /* Ultra-smooth custom scrollbar */
          ::-webkit-scrollbar {
            width: 4px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: ${BRAND.sage}40;
            border-radius: 2px;
          }

          /* Reveal animations */
          .reveal-on-scroll {
            opacity: 0;
            transform: translateY(60px);
            transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                        transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .reveal-on-scroll.revealed {
            opacity: 1;
            transform: translateY(0);
          }

          .reveal-scale {
            opacity: 0;
            transform: scale(0.95);
            transition: opacity 1s cubic-bezier(0.16, 1, 0.3, 1),
                        transform 1s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .reveal-scale.revealed {
            opacity: 1;
            transform: scale(1);
          }

          .reveal-clip {
            clip-path: inset(100% 0 0 0);
            transition: clip-path 1.2s cubic-bezier(0.77, 0, 0.175, 1);
          }
          .reveal-clip.revealed {
            clip-path: inset(0 0 0 0);
          }

          /* Stagger children */
          .stagger-children > * {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
                        transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .stagger-children.revealed > *:nth-child(1) { transition-delay: 0ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(2) { transition-delay: 80ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(3) { transition-delay: 160ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(4) { transition-delay: 240ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(5) { transition-delay: 320ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(6) { transition-delay: 400ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(7) { transition-delay: 480ms; opacity: 1; transform: translateY(0); }

          /* Magnetic button */
          .btn-magnetic {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 18px 48px;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.25em;
            color: ${BRAND.cream};
            background: transparent;
            border: 1px solid ${BRAND.sage}60;
            overflow: hidden;
            transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            cursor: pointer;
          }
          .btn-magnetic::before {
            content: '';
            position: absolute;
            inset: 0;
            background: ${BRAND.sage};
            transform: scaleY(0);
            transform-origin: bottom;
            transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: -1;
          }
          .btn-magnetic:hover {
            color: #06060a;
            border-color: ${BRAND.sage};
          }
          .btn-magnetic:hover::before {
            transform: scaleY(1);
          }

          /* 3D Card tilt */
          .card-3d {
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            transform-style: preserve-3d;
          }
          .card-3d:hover {
            transform: perspective(1000px) rotateX(2deg) rotateY(-2deg) scale(1.02);
          }

          /* Image hover zoom */
          .img-zoom {
            overflow: hidden;
          }
          .img-zoom img {
            transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .img-zoom:hover img {
            transform: scale(1.08);
          }

          /* Text gradient */
          .text-gradient {
            background: linear-gradient(135deg, ${BRAND.sage} 0%, ${BRAND.sageLight} 50%, ${BRAND.sage} 100%);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: gradient-shift 8s ease infinite;
          }
          @keyframes gradient-shift {
            0%, 100% { background-position: 0% center; }
            50% { background-position: 200% center; }
          }

          /* Line draw animation */
          .line-draw {
            position: relative;
          }
          .line-draw::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 1px;
            background: ${BRAND.sage};
            transform: scaleX(0);
            transform-origin: left;
            transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .line-draw:hover::after {
            transform: scaleX(1);
          }

          /* Eyebrow style */
          .eyebrow {
            font-size: 10px;
            letter-spacing: 0.4em;
            text-transform: uppercase;
            color: ${BRAND.sage};
          }

          /* Smooth parallax */
          .parallax-slow {
            will-change: transform;
          }
        `}</style>

        {/* ═══════════════════════════════════════════════════════════════
            CUSTOM CURSOR
            ═══════════════════════════════════════════════════════════════ */}
        <div
          className="fixed w-4 h-4 rounded-full pointer-events-none z-[99] mix-blend-difference hidden md:block"
          style={{
            background: BRAND.sage,
            left: `calc(50% + ${mousePos.x * 10}px)`,
            top: `calc(50% + ${mousePos.y * 10}px)`,
            transform: "translate(-50%, -50%)",
            transition: "left 0.15s ease-out, top 0.15s ease-out",
          }}
        />

        {/* ═══════════════════════════════════════════════════════════════
            HEADER — Floating Glass Navigation
            ═══════════════════════════════════════════════════════════════ */}
        <header
          className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-12 transition-all duration-500 ${
            scrollY > 100
              ? "py-4 bg-[#06060a]/80 backdrop-blur-xl border-b border-white/5"
              : "py-8"
          }`}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <a
              href="#"
              className="relative w-12 h-12 transition-transform duration-300 hover:scale-110"
              style={{
                transform: `translate(${mousePos.x * 3}px, ${mousePos.y * 3}px)`,
              }}
            >
              <Image
                src="/demos/stefanos-bistro/logo.png"
                alt="Stefano's Bistro"
                fill
                className="object-contain"
              />
            </a>

            <nav className="hidden md:flex items-center gap-12">
              {[
                { label: "Menú", href: "#menu" },
                { label: "Historia", href: "#historia" },
                { label: "Reservar", href: "#reservar" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-[11px] tracking-[0.2em] uppercase text-white/40 hover:text-white transition-all duration-300 line-draw py-2"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
              className="btn-magnetic text-xs !px-6 !py-3"
            >
              Reservar
            </a>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════
            HERO — Cinematic Full-Screen Video
            ═══════════════════════════════════════════════════════════════ */}
        <section className="relative h-[100svh] w-full overflow-hidden">
          {/* Video with parallax */}
          <div
            className="absolute inset-0 parallax-slow"
            style={{ transform: `translateY(${parallax(0.3)}px) scale(1.1)` }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            >
              <source src="/demos/stefanos-bistro/hero-video.mp4" type="video/mp4" />
            </video>
          </div>

          {/* Layered gradients for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#06060a]/40 via-transparent to-[#06060a]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06060a]/30 via-transparent to-[#06060a]/30" />
          <div className="absolute inset-0 shadow-[inset_0_0_300px_rgba(0,0,0,0.7)]" />

          {/* Hero Content */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
            <div
              className="text-center"
              style={{
                transform: `translate(${mousePos.x * -10}px, ${mousePos.y * -10}px)`,
                transition: "transform 0.3s ease-out",
              }}
            >
              {/* Floating logo */}
              <div
                className="mb-10 reveal-on-scroll"
                style={{
                  transform: `translateY(${parallax(-0.1)}px)`,
                }}
              >
                <div className="w-28 h-28 md:w-36 md:h-36 mx-auto relative">
                  <div
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{
                      background: `radial-gradient(circle, ${BRAND.sage}30 0%, transparent 70%)`,
                      transform: "scale(1.5)",
                    }}
                  />
                  <Image
                    src="/demos/stefanos-bistro/logo.png"
                    alt="Stefano's Bistro"
                    fill
                    className="object-contain relative z-10"
                  />
                </div>
              </div>

              {/* Tagline */}
              <p className="eyebrow mb-8 reveal-on-scroll">
                Cartagena de Indias
              </p>

              {/* Main headline with stagger */}
              <h1 className="font-clash text-5xl md:text-7xl lg:text-[110px] font-light tracking-tight leading-[0.9] mb-10 stagger-children reveal-on-scroll">
                <span className="block text-white">Italian</span>
                <span className="block text-gradient py-2">&amp;</span>
                <span className="block text-white">French</span>
              </h1>

              {/* Subheadline */}
              <p className="text-white/40 text-lg md:text-xl max-w-lg mx-auto mb-14 font-light leading-relaxed reveal-on-scroll">
                Más de 40 años de excelencia culinaria.
                <br />
                <span className="text-white/20">Autenticidad. Pasión. Arte.</span>
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 reveal-on-scroll">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
                  className="btn-magnetic"
                >
                  Reservar Mesa
                </a>
                <a
                  href="#menu"
                  className="btn-magnetic !border-white/10"
                >
                  Explorar Menú
                </a>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
              <span className="text-[9px] tracking-[0.4em] uppercase text-white/20">
                Scroll
              </span>
              <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent relative overflow-hidden">
                <div
                  className="absolute inset-x-0 h-4 bg-white/60"
                  style={{
                    top: `${(scrollY % 48)}px`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            PHILOSOPHY — Apple-style Sticky Text
            ═══════════════════════════════════════════════════════════════ */}
        <section className="py-40 md:py-56 px-6 relative overflow-hidden">
          {/* Background glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full opacity-[0.03]"
            style={{
              background: `radial-gradient(circle, ${BRAND.sage} 0%, transparent 60%)`,
              transform: `translate(-50%, -50%) translate(${mousePos.x * 30}px, ${mousePos.y * 30}px)`,
              transition: "transform 0.5s ease-out",
            }}
          />

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <p className="eyebrow mb-10 reveal-on-scroll">Nuestra Filosofía</p>

            <blockquote
              className="font-clash text-3xl md:text-5xl lg:text-6xl font-light leading-[1.2] mb-12 reveal-on-scroll"
              style={{
                transform: `translateY(${parallax(-0.05)}px)`,
              }}
            >
              <span className="text-white/90">
                &ldquo;La cocina no es solo alimentar el cuerpo,
              </span>
              <br />
              <span className="text-gradient">
                es nutrir el alma.&rdquo;
              </span>
            </blockquote>

            <p className="text-white/30 text-sm uppercase tracking-[0.3em] reveal-on-scroll">
              — Chef Stephen Ng
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            MENU — Immersive Gallery with Parallax
            ═══════════════════════════════════════════════════════════════ */}
        <section id="menu" className="py-32 relative">
          <div className="max-w-7xl mx-auto px-6">
            {/* Section header */}
            <div className="text-center mb-24 reveal-on-scroll">
              <p className="eyebrow mb-6">Nuestra Carta</p>
              <h2 className="font-clash text-4xl md:text-6xl lg:text-7xl font-light text-white">
                Platos Signature
              </h2>
            </div>

            {/* Menu items */}
            <div className="space-y-40 md:space-y-56">
              {menuHighlights.map((item, index) => (
                <div
                  key={index}
                  className={`grid md:grid-cols-2 gap-12 md:gap-20 items-center ${
                    index % 2 === 1 ? "md:[direction:rtl]" : ""
                  }`}
                >
                  {/* Image */}
                  <div
                    className="reveal-on-scroll reveal-clip md:[direction:ltr]"
                    style={{
                      transform: `translateY(${parallax(index % 2 === 0 ? -0.02 : 0.02)}px)`,
                    }}
                  >
                    <div className="relative aspect-[4/3] img-zoom card-3d">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                      {/* Price badge */}
                      <div className="absolute bottom-6 right-6 z-10">
                        <span
                          className="px-5 py-2.5 text-sm font-clash tracking-wider backdrop-blur-sm"
                          style={{ background: `${BRAND.sage}e0`, color: "#06060a" }}
                        >
                          {item.price}
                        </span>
                      </div>
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#06060a]/60 via-transparent to-transparent" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="md:[direction:ltr] reveal-on-scroll">
                    <span className="eyebrow block mb-6">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="font-clash text-3xl md:text-4xl lg:text-5xl font-light mb-3 text-white">
                      {item.name}
                    </h3>
                    <p className="font-instrument text-xl text-white/30 italic mb-8">
                      {item.nameSp}
                    </p>
                    <p className="text-white/50 text-lg md:text-xl leading-relaxed max-w-md">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="text-center mt-32 reveal-on-scroll">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
                className="btn-magnetic"
              >
                Ver Menú Completo
              </a>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            STORY — Chef Section with Depth
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="historia"
          className="py-40 md:py-56 relative overflow-hidden"
        >
          {/* Background grid */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `
                linear-gradient(${BRAND.sage}20 1px, transparent 1px),
                linear-gradient(90deg, ${BRAND.sage}20 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
              transform: `translateY(${parallax(0.05)}px)`,
            }}
          />

          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="grid md:grid-cols-2 gap-20 md:gap-32 items-center">
              {/* Image */}
              <div
                className="reveal-on-scroll reveal-scale"
                style={{ transform: `translateY(${parallax(-0.03)}px)` }}
              >
                <div className="relative">
                  <div className="aspect-[3/4] bg-gradient-to-br from-[rgba(163,168,140,0.08)] to-transparent flex items-center justify-center border border-white/5 card-3d">
                    <div className="text-center">
                      <div className="w-36 h-36 mx-auto mb-8 relative">
                        <Image
                          src="/demos/stefanos-bistro/logo.png"
                          alt="Chef"
                          fill
                          className="object-contain opacity-70"
                        />
                      </div>
                      <p className="eyebrow mb-2">Executive Chef</p>
                      <p className="font-clash text-2xl text-white/80">Stephen Ng</p>
                    </div>
                  </div>
                  {/* Decorative lines */}
                  <div className="absolute -bottom-6 -right-6 w-full h-full border border-white/5 -z-10" />
                </div>
              </div>

              {/* Content */}
              <div>
                <p className="eyebrow mb-8 reveal-on-scroll">Nuestra Historia</p>
                <h2 className="font-clash text-4xl md:text-5xl lg:text-6xl font-light mb-10 reveal-on-scroll">
                  <span className="text-white">40 Años de</span>
                  <br />
                  <span className="text-gradient">Excelencia</span>
                </h2>

                <div className="space-y-6 stagger-children reveal-on-scroll">
                  <p className="text-white/50 text-lg leading-relaxed">
                    Con más de <span className="text-white">cuatro décadas de experiencia</span>,
                    el Chef Stephen Ng ha dedicado su vida a perfeccionar el arte de la
                    cocina italiana y francesa.
                  </p>
                  <p className="text-white/50 text-lg leading-relaxed">
                    Cada plato es una obra maestra que fusiona técnicas tradicionales
                    con ingredientes de la más alta calidad.
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-8 mt-16 pt-12 border-t border-white/5 reveal-on-scroll">
                  {[
                    { number: "40+", label: "Años" },
                    { number: "2", label: "Cocinas" },
                    { number: "4.9", label: "Rating" },
                  ].map((stat, i) => (
                    <div key={i} className="text-center">
                      <p className="font-clash text-4xl md:text-5xl text-gradient">
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
            EXPERIENCE — 3D Cards
            ═══════════════════════════════════════════════════════════════ */}
        <section className="py-32 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20 reveal-on-scroll">
              <p className="eyebrow mb-6">La Experiencia</p>
              <h2 className="font-clash text-4xl md:text-5xl font-light text-white">
                Momentos Memorables
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 stagger-children reveal-on-scroll">
              {[
                { icon: "◇", title: "Cenas Románticas", desc: "Iluminación íntima y ambiente acogedor para momentos especiales." },
                { icon: "✦", title: "Celebraciones", desc: "El escenario perfecto para cumpleaños y aniversarios." },
                { icon: "○", title: "Encuentros", desc: "Ambiente versátil para reuniones con amigos." },
              ].map((item, i) => (
                <div
                  key={i}
                  className="card-3d p-10 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-500 group"
                >
                  <span
                    className="text-4xl block mb-6 transition-transform duration-500 group-hover:scale-110"
                    style={{ color: BRAND.sage }}
                  >
                    {item.icon}
                  </span>
                  <h3 className="font-clash text-2xl mb-4 text-white">{item.title}</h3>
                  <p className="text-white/40 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            RESERVATIONS
            ═══════════════════════════════════════════════════════════════ */}
        <section
          id="reservar"
          className="py-32 relative"
          style={{
            background: `linear-gradient(180deg, transparent, ${BRAND.sage}08, transparent)`,
          }}
        >
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-20 md:gap-32">
              {/* Hours */}
              <div className="reveal-on-scroll">
                <p className="eyebrow mb-6">Horario</p>
                <h2 className="font-clash text-3xl md:text-4xl font-light mb-12 text-white">
                  Horas de Atención
                </h2>
                <div className="space-y-0 stagger-children reveal-on-scroll">
                  {hours.map((item, i) => (
                    <div
                      key={i}
                      className={`flex justify-between py-4 border-b border-white/5 ${
                        item.closed ? "opacity-30" : ""
                      }`}
                    >
                      <span className="text-white/50">{item.day}</span>
                      <span className="text-white">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="reveal-on-scroll">
                <p className="eyebrow mb-6">Ubicación</p>
                <h2 className="font-clash text-3xl md:text-4xl font-light mb-12 text-white">
                  Visítanos
                </h2>
                <div className="space-y-8 stagger-children reveal-on-scroll">
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-[0.2em] mb-2">Dirección</p>
                    <p className="text-white text-lg">Calle del Arsenal #8B-42<br />Centro Histórico, Cartagena</p>
                  </div>
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-[0.2em] mb-2">Teléfono</p>
                    <p className="text-white text-lg">+57 300 123 4567</p>
                  </div>
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-[0.2em] mb-2">Email</p>
                    <p className="text-white text-lg">reservas@stefanosbistro.co</p>
                  </div>
                </div>

                <div className="mt-12">
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`}
                    className="btn-magnetic w-full justify-center"
                  >
                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Reservar por WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            FOOTER
            ═══════════════════════════════════════════════════════════════ */}
        <footer className="py-20 px-6 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="text-center md:text-left flex items-center gap-6">
                <div className="w-16 h-16 relative">
                  <Image
                    src="/demos/stefanos-bistro/logo.png"
                    alt="Stefano's Bistro"
                    fill
                    className="object-contain opacity-70"
                  />
                </div>
                <div>
                  <p className="font-clash text-xl text-white/80">Stefano&apos;s Bistro</p>
                  <p className="text-white/30 text-sm">Cartagena de Indias</p>
                </div>
              </div>

              <div className="flex items-center gap-10">
                {["Instagram", "Facebook", "WhatsApp"].map((s) => (
                  <a
                    key={s}
                    href="#"
                    className="text-white/30 hover:text-white text-xs uppercase tracking-[0.15em] transition-colors line-draw py-1"
                  >
                    {s}
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-white/20 text-xs">
              <p>© {new Date().getFullYear()} Stefano&apos;s Bistro</p>
              <p>
                Creado por{" "}
                <a
                  href="https://machinemindconsulting.com"
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
    </>
  );
}

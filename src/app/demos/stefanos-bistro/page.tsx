"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

// Full Menu Data
const menuCategories = [
  {
    name: "Starters",
    nameSp: "Entradas",
    items: [
      { name: "French Onion Soup", nameSp: "Sopa de Cebolla Francesa", desc: "Caramelized onion broth, gruyère crouton, fresh thyme", price: "$18.000" },
      { name: "Beef Carpaccio", nameSp: "Carpaccio de Res", desc: "Thinly sliced tenderloin, arugula, capers, parmesan shavings", price: "$22.000" },
      { name: "Escargots de Bourgogne", nameSp: "Caracoles a la Borgoña", desc: "Burgundy snails, garlic herb butter, crusty bread", price: "$19.000" },
      { name: "Burrata Caprese", nameSp: "Caprese de Burrata", desc: "Fresh burrata, heirloom tomatoes, basil pesto, balsamic reduction", price: "$21.000" },
    ],
  },
  {
    name: "Mains",
    nameSp: "Platos Principales",
    items: [
      { name: "Pecan Crusted Fish", nameSp: "Pescado con Costra de Nuez", desc: "Atlantic salmon, toasted pecan crust, beurre blanc, seasonal vegetables", price: "$38.000", featured: true, image: "/demos/stefanos-bistro/food-fish.jpg" },
      { name: "Beef Short Ribs", nameSp: "Costillas de Res", desc: "8-hour braised short ribs, red wine reduction, truffle mash", price: "$42.000" },
      { name: "Duck Confit", nameSp: "Confit de Pato", desc: "Crispy leg confit, cherry gastrique, wild rice pilaf", price: "$36.000" },
      { name: "Filet Mignon", nameSp: "Filete Mignon", desc: "8oz center cut, béarnaise sauce, pommes frites", price: "$48.000" },
      { name: "Crab Risotto", nameSp: "Risotto de Cangrejo", desc: "Arborio rice, blue crab, saffron, aged parmesan", price: "$34.000" },
      { name: "Chicken Supreme", nameSp: "Suprema de Pollo", desc: "Pan-roasted breast, mushroom jus, herb gnocchi", price: "$32.000" },
    ],
  },
  {
    name: "Signature Burger",
    nameSp: "Hamburguesa Signature",
    items: [
      { name: "The Stefano Burger", nameSp: "La Hamburguesa Stefano", desc: "Brioche bun, thick-cut bacon, aged cheddar, house sauce, truffle fries", price: "$28.000", featured: true, image: "/demos/stefanos-bistro/food-burger.jpg" },
    ],
  },
  {
    name: "Pasta & Pizza",
    nameSp: "Pastas y Pizzas",
    items: [
      { name: "Lobster Linguine", nameSp: "Linguine de Langosta", desc: "Fresh pasta, butter-poached lobster, cherry tomatoes, basil", price: "$38.000" },
      { name: "Truffle Tagliatelle", nameSp: "Tagliatelle de Trufa", desc: "House-made pasta, black truffle cream, parmesan", price: "$32.000" },
      { name: "Margherita Pizza", nameSp: "Pizza Margherita", desc: "San Marzano tomatoes, fresh mozzarella, basil, olive oil", price: "$22.000" },
      { name: "Prosciutto e Rucola", nameSp: "Prosciutto y Rúcula", desc: "Parma ham, arugula, shaved parmesan, truffle oil", price: "$26.000" },
    ],
  },
  {
    name: "Desserts",
    nameSp: "Postres",
    items: [
      { name: "Apple Crumble Cheesecake", nameSp: "Cheesecake de Manzana", desc: "New York style, caramelized apples, oat crumble, vanilla gelato", price: "$14.000" },
      { name: "Crème Brûlée", nameSp: "Crème Brûlée", desc: "Classic vanilla custard, caramelized sugar crust", price: "$12.000" },
      { name: "Tiramisu", nameSp: "Tiramisú", desc: "Espresso-soaked ladyfingers, mascarpone, cocoa", price: "$13.000" },
      { name: "Chocolate Fondant", nameSp: "Fondant de Chocolate", desc: "Warm molten center, raspberry coulis, whipped cream", price: "$14.000" },
    ],
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
  const [activeCategory, setActiveCategory] = useState(0);
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
            <img
              src="/demos/stefanos-bistro/logo.png"
              alt="Stefano's Bistro"
              className="w-full h-full object-contain"
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
            to { stroke-dashoffset: 0; }
          }

          html { scroll-behavior: smooth; }

          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${BRAND.sage}40; border-radius: 2px; }

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

          .stagger-children > * {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
                        transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .stagger-children.revealed > *:nth-child(1) { transition-delay: 0ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(2) { transition-delay: 60ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(3) { transition-delay: 120ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(4) { transition-delay: 180ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(5) { transition-delay: 240ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(6) { transition-delay: 300ms; opacity: 1; transform: translateY(0); }
          .stagger-children.revealed > *:nth-child(7) { transition-delay: 360ms; opacity: 1; transform: translateY(0); }

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

          .card-3d {
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            transform-style: preserve-3d;
          }
          .card-3d:hover {
            transform: perspective(1000px) rotateX(2deg) rotateY(-2deg) scale(1.02);
          }

          .img-zoom {
            overflow: hidden;
          }
          .img-zoom img {
            transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .img-zoom:hover img {
            transform: scale(1.08);
          }

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

          .eyebrow {
            font-size: 10px;
            letter-spacing: 0.4em;
            text-transform: uppercase;
            color: ${BRAND.sage};
          }

          .menu-tab {
            padding: 12px 24px;
            font-size: 11px;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.4);
            border: 1px solid transparent;
            transition: all 0.3s ease;
            cursor: pointer;
            white-space: nowrap;
          }
          .menu-tab:hover {
            color: rgba(255,255,255,0.7);
          }
          .menu-tab.active {
            color: ${BRAND.cream};
            border-color: ${BRAND.sage}60;
            background: ${BRAND.sage}10;
          }

          .menu-item {
            padding: 24px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            transition: all 0.3s ease;
          }
          .menu-item:hover {
            background: rgba(255,255,255,0.02);
            padding-left: 16px;
          }
        `}</style>

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
            <a href="#" className="relative w-12 h-12 transition-transform duration-300 hover:scale-110">
              <img
                src="/demos/stefanos-bistro/logo.png"
                alt="Stefano's Bistro"
                className="w-full h-full object-contain"
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
            className="absolute inset-0"
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
          <div className="absolute inset-0 bg-gradient-to-b from-[#06060a]/50 via-transparent to-[#06060a]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06060a]/40 via-transparent to-[#06060a]/40" />
          <div className="absolute inset-0 shadow-[inset_0_0_300px_rgba(0,0,0,0.7)]" />

          {/* Hero Content */}
          <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
            <div className="text-center">
              {/* Floating logo */}
              <div className="mb-10 reveal-on-scroll">
                <div className="w-28 h-28 md:w-36 md:h-36 mx-auto relative">
                  <div
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{
                      background: `radial-gradient(circle, ${BRAND.sage}30 0%, transparent 70%)`,
                      transform: "scale(1.5)",
                    }}
                  />
                  <img
                    src="/demos/stefanos-bistro/logo.png"
                    alt="Stefano's Bistro"
                    className="w-full h-full object-contain relative z-10"
                  />
                </div>
              </div>

              {/* Tagline */}
              <p className="eyebrow mb-8 reveal-on-scroll">Cartagena de Indias</p>

              {/* Main headline */}
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
                <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`} className="btn-magnetic">
                  Reservar Mesa
                </a>
                <a href="#menu" className="btn-magnetic !border-white/10">
                  Explorar Menú
                </a>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
              <span className="text-[9px] tracking-[0.4em] uppercase text-white/20">Scroll</span>
              <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent" />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            FEATURED DISHES — Full-Width Image Gallery
            ═══════════════════════════════════════════════════════════════ */}
        <section className="py-32 relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-20 reveal-on-scroll">
              <p className="eyebrow mb-6">Destacados</p>
              <h2 className="font-clash text-4xl md:text-6xl font-light text-white">
                Signature Dishes
              </h2>
            </div>

            {/* Featured Images Grid */}
            <div className="grid md:grid-cols-2 gap-8 reveal-on-scroll">
              {/* Fish Dish */}
              <div className="group relative aspect-[4/3] img-zoom card-3d">
                <img
                  src="/demos/stefanos-bistro/food-fish.jpg"
                  alt="Pecan Crusted Fish"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#06060a]/80 via-[#06060a]/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <p className="eyebrow mb-2">Signature</p>
                  <h3 className="font-clash text-2xl md:text-3xl text-white mb-2">Pecan Crusted Fish</h3>
                  <p className="text-white/50 text-sm mb-3">Atlantic salmon, toasted pecan crust, beurre blanc</p>
                  <span className="inline-block px-4 py-2 text-sm font-clash" style={{ background: BRAND.sage, color: "#06060a" }}>
                    $38
                  </span>
                </div>
              </div>

              {/* Burger */}
              <div className="group relative aspect-[4/3] img-zoom card-3d">
                <img
                  src="/demos/stefanos-bistro/food-burger.jpg"
                  alt="Signature Burger"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#06060a]/80 via-[#06060a]/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <p className="eyebrow mb-2">Signature</p>
                  <h3 className="font-clash text-2xl md:text-3xl text-white mb-2">The Stefano Burger</h3>
                  <p className="text-white/50 text-sm mb-3">Brioche bun, thick-cut bacon, house sauce, truffle fries</p>
                  <span className="inline-block px-4 py-2 text-sm font-clash" style={{ background: BRAND.sage, color: "#06060a" }}>
                    $28
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            PHILOSOPHY — Quote Section
            ═══════════════════════════════════════════════════════════════ */}
        <section className="py-40 md:py-56 px-6 relative overflow-hidden">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full opacity-[0.03]"
            style={{ background: `radial-gradient(circle, ${BRAND.sage} 0%, transparent 60%)` }}
          />

          <div className="max-w-5xl mx-auto text-center relative z-10">
            <p className="eyebrow mb-10 reveal-on-scroll">Nuestra Filosofía</p>
            <blockquote className="font-clash text-3xl md:text-5xl lg:text-6xl font-light leading-[1.2] mb-12 reveal-on-scroll">
              <span className="text-white/90">&ldquo;La cocina no es solo alimentar el cuerpo,</span>
              <br />
              <span className="text-gradient">es nutrir el alma.&rdquo;</span>
            </blockquote>
            <p className="text-white/30 text-sm uppercase tracking-[0.3em] reveal-on-scroll">— Chef Stephen Ng</p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            FULL MENU — Tabbed Categories
            ═══════════════════════════════════════════════════════════════ */}
        <section id="menu" className="py-32 relative">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16 reveal-on-scroll">
              <p className="eyebrow mb-6">Nuestra Carta</p>
              <h2 className="font-clash text-4xl md:text-6xl font-light text-white">The Menu</h2>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-16 reveal-on-scroll">
              {menuCategories.map((cat, i) => (
                <button
                  key={i}
                  onClick={() => setActiveCategory(i)}
                  className={`menu-tab ${activeCategory === i ? "active" : ""}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Items */}
            <div className="reveal-on-scroll">
              <div className="mb-8">
                <h3 className="font-clash text-2xl text-white mb-2">{menuCategories[activeCategory].name}</h3>
                <p className="text-white/30 font-instrument italic">{menuCategories[activeCategory].nameSp}</p>
              </div>

              <div className="stagger-children revealed">
                {menuCategories[activeCategory].items.map((item, i) => (
                  <div key={i} className="menu-item flex justify-between items-start gap-8">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-clash text-lg text-white">{item.name}</h4>
                        {item.featured && (
                          <span className="text-[9px] tracking-wider uppercase px-2 py-0.5" style={{ background: `${BRAND.sage}30`, color: BRAND.sage }}>
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="text-white/30 text-sm font-instrument italic mb-2">{item.nameSp}</p>
                      <p className="text-white/50 text-sm">{item.desc}</p>
                    </div>
                    <span className="font-clash text-xl text-gradient shrink-0">{item.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center mt-16 reveal-on-scroll">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`} className="btn-magnetic">
                Reservar Mesa
              </a>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            STORY — Chef Section
            ═══════════════════════════════════════════════════════════════ */}
        <section id="historia" className="py-40 md:py-56 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(${BRAND.sage}20 1px, transparent 1px), linear-gradient(90deg, ${BRAND.sage}20 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />

          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="grid md:grid-cols-2 gap-20 md:gap-32 items-center">
              {/* Image */}
              <div className="reveal-on-scroll reveal-scale">
                <div className="relative">
                  <div className="aspect-[3/4] bg-gradient-to-br from-[rgba(163,168,140,0.08)] to-transparent flex items-center justify-center border border-white/5 card-3d">
                    <div className="text-center">
                      <div className="w-36 h-36 mx-auto mb-8 relative">
                        <img
                          src="/demos/stefanos-bistro/logo.png"
                          alt="Chef"
                          className="w-full h-full object-contain opacity-70"
                        />
                      </div>
                      <p className="eyebrow mb-2">Executive Chef</p>
                      <p className="font-clash text-2xl text-white/80">Stephen Ng</p>
                    </div>
                  </div>
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
                      <p className="font-clash text-4xl md:text-5xl text-gradient">{stat.number}</p>
                      <p className="text-white/30 text-xs uppercase tracking-wider mt-2">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            EXPERIENCE — Cards
            ═══════════════════════════════════════════════════════════════ */}
        <section className="py-32 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20 reveal-on-scroll">
              <p className="eyebrow mb-6">La Experiencia</p>
              <h2 className="font-clash text-4xl md:text-5xl font-light text-white">Momentos Memorables</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 stagger-children reveal-on-scroll">
              {[
                { icon: "◇", title: "Cenas Románticas", desc: "Iluminación íntima y ambiente acogedor para momentos especiales." },
                { icon: "✦", title: "Celebraciones", desc: "El escenario perfecto para cumpleaños y aniversarios." },
                { icon: "○", title: "Encuentros", desc: "Ambiente versátil para reuniones con amigos." },
              ].map((item, i) => (
                <div key={i} className="card-3d p-10 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-500 group">
                  <span className="text-4xl block mb-6 transition-transform duration-500 group-hover:scale-110" style={{ color: BRAND.sage }}>
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
        <section id="reservar" className="py-32 relative" style={{ background: `linear-gradient(180deg, transparent, ${BRAND.sage}08, transparent)` }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-20 md:gap-32">
              {/* Hours */}
              <div className="reveal-on-scroll">
                <p className="eyebrow mb-6">Horario</p>
                <h2 className="font-clash text-3xl md:text-4xl font-light mb-12 text-white">Horas de Atención</h2>
                <div className="space-y-0 stagger-children reveal-on-scroll">
                  {hours.map((item, i) => (
                    <div key={i} className={`flex justify-between py-4 border-b border-white/5 ${item.closed ? "opacity-30" : ""}`}>
                      <span className="text-white/50">{item.day}</span>
                      <span className="text-white">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="reveal-on-scroll">
                <p className="eyebrow mb-6">Ubicación</p>
                <h2 className="font-clash text-3xl md:text-4xl font-light mb-12 text-white">Visítanos</h2>
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
                  <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`} className="btn-magnetic w-full justify-center">
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
                  <img src="/demos/stefanos-bistro/logo.png" alt="Stefano's Bistro" className="w-full h-full object-contain opacity-70" />
                </div>
                <div>
                  <p className="font-clash text-xl text-white/80">Stefano&apos;s Bistro</p>
                  <p className="text-white/30 text-sm">Cartagena de Indias</p>
                </div>
              </div>

              <div className="flex items-center gap-10">
                {["Instagram", "Facebook", "WhatsApp"].map((s) => (
                  <a key={s} href="#" className="text-white/30 hover:text-white text-xs uppercase tracking-[0.15em] transition-colors line-draw py-1">
                    {s}
                  </a>
                ))}
              </div>
            </div>

            <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-white/20 text-xs">
              <p>© {new Date().getFullYear()} Stefano&apos;s Bistro</p>
              <p>
                Creado por{" "}
                <a href="https://machinemindconsulting.com" className="hover:text-white transition-colors" style={{ color: BRAND.sage }}>
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

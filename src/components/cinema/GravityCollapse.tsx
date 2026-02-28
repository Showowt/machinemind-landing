"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Matter.js Gravity Collapse Section
 * The signature MachineMind "Gravity Pitch" effect
 * WORLD-CLASS $50M AESTHETIC
 */
export default function GravityCollapse() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [counter, setCounter] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection observer for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Animate counter
          let current = 0;
          const target = 120000;
          const duration = 2000;
          const increment = target / (duration / 16);
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setCounter(target);
              clearInterval(timer);
            } else {
              setCounter(Math.floor(current));
            }
          }, 16);
        }
      },
      { threshold: 0.3 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
    }[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.2,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 180, 255, ${p.alpha})`;
        ctx.fill();
      });

      // Draw connections
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(0, 180, 255, ${0.1 * (1 - dist / 120)})`;
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const triggerGravity = () => {
    if (collapsed) return;
    setCollapsed(true);

    // Screen shake
    document.body.style.animation = "shake 0.5s ease-in-out";
    setTimeout(() => {
      document.body.style.animation = "";
    }, 500);

    const Matter = (window as unknown as { Matter: typeof import("matter-js") })
      .Matter;
    if (!Matter) {
      // Fallback if Matter.js not loaded - just show overlay
      setTimeout(() => setShowOverlay(true), 500);
      return;
    }

    const { Engine, Runner, Bodies, Body, Composite, Events } = Matter;
    const engine = Engine.create();
    engine.world.gravity.y = 2.5;
    const runner = Runner.create();

    // Walls
    const wallOpts = { isStatic: true };
    Composite.add(engine.world, [
      Bodies.rectangle(
        window.innerWidth / 2,
        window.innerHeight + 30,
        window.innerWidth + 200,
        60,
        wallOpts,
      ),
      Bodies.rectangle(
        -30,
        window.innerHeight / 2,
        60,
        window.innerHeight + 200,
        wallOpts,
      ),
      Bodies.rectangle(
        window.innerWidth + 30,
        window.innerHeight / 2,
        60,
        window.innerHeight + 200,
        wallOpts,
      ),
    ]);

    const section = sectionRef.current;
    if (!section) return;

    const tracked: {
      el: HTMLElement;
      body: Matter.Body;
      w: number;
      h: number;
    }[] = [];
    const elements = section.querySelectorAll<HTMLElement>(".collapse-item");

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      el.style.position = "fixed";
      el.style.left = rect.left + "px";
      el.style.top = rect.top + "px";
      el.style.width = rect.width + "px";
      el.style.height = rect.height + "px";
      el.style.transition = "none";
      el.style.zIndex = "9000";

      const body = Bodies.rectangle(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect.width,
        rect.height,
        { restitution: 0.3, friction: 0.4, chamfer: { radius: 6 } },
      );

      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.12);
      Composite.add(engine.world, body);
      tracked.push({ el, body, w: rect.width, h: rect.height });
    });

    Runner.run(runner, engine);

    Events.on(engine, "afterUpdate", () => {
      tracked.forEach(({ el, body, w, h }) => {
        el.style.left = body.position.x - w / 2 + "px";
        el.style.top = body.position.y - h / 2 + "px";
        el.style.transform = `rotate(${body.angle}rad)`;
      });
    });

    setTimeout(() => setShowOverlay(true), 1500);
  };

  const formatMoney = (n: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  };

  return (
    <>
      {/* Shake keyframes */}
      <style jsx global>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-5px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(5px);
          }
        }
        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(0, 180, 255, 0.3);
          }
          50% {
            box-shadow:
              0 0 40px rgba(0, 180, 255, 0.6),
              0 0 60px rgba(0, 180, 255, 0.3);
          }
        }
        @keyframes float-up {
          0% {
            opacity: 0;
            transform: translateY(40px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes counter-pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }
      `}</style>

      <section
        ref={sectionRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden py-20"
        style={{ background: "var(--mm-void)" }}
      >
        {/* Particle Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-0"
          style={{ pointerEvents: "none" }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 z-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(var(--mm-blue-core) 1px, transparent 1px),
              linear-gradient(90deg, var(--mm-blue-core) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Radial gradient glow */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,180,255,0.08) 0%, transparent 70%)",
          }}
        />

        {!collapsed && (
          <div
            className="container-luxury relative z-10 text-center"
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(40px)",
              transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Section badge */}
            <div
              className="collapse-item mb-8"
              style={{
                animation: isVisible
                  ? "float-up 0.6s ease-out forwards"
                  : "none",
              }}
            >
              <span
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-mono uppercase tracking-[0.2em]"
                style={{
                  border: "1px solid var(--mm-border-hover)",
                  color: "var(--mm-blue-core)",
                  background: "rgba(0, 180, 255, 0.05)",
                }}
              >
                <span className="w-2 h-2 bg-[var(--mm-blue-core)] animate-pulse" />
                Revenue Analysis
              </span>
            </div>

            {/* Main headline */}
            <h2
              className="collapse-item font-heading text-4xl md:text-6xl lg:text-7xl font-bold mb-6"
              style={{
                color: "var(--mm-text)",
                animation: isVisible
                  ? "float-up 0.6s ease-out 0.1s forwards"
                  : "none",
                opacity: 0,
              }}
            >
              Without AI Automation
            </h2>

            <p
              className="collapse-item text-lg md:text-xl mb-12 max-w-2xl mx-auto"
              style={{
                color: "var(--mm-text-muted)",
                animation: isVisible
                  ? "float-up 0.6s ease-out 0.2s forwards"
                  : "none",
                opacity: 0,
              }}
            >
              Your business is hemorrhaging revenue every single day
            </p>

            {/* Stats grid */}
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16"
              style={{
                animation: isVisible
                  ? "float-up 0.6s ease-out 0.3s forwards"
                  : "none",
                opacity: 0,
              }}
            >
              <div
                className="collapse-item p-8 backdrop-blur-sm"
                style={{
                  border: "1px solid var(--mm-border)",
                  background: "rgba(0, 180, 255, 0.03)",
                }}
              >
                <div
                  className="text-4xl md:text-5xl font-bold mb-2 font-mono"
                  style={{ color: "var(--mm-blue-core)" }}
                >
                  $2,400
                </div>
                <div
                  style={{ color: "var(--mm-text-muted)" }}
                  className="text-sm uppercase tracking-wider"
                >
                  Lost Per Week
                </div>
                <div
                  style={{ color: "var(--mm-text-subtle)" }}
                  className="text-xs mt-2"
                >
                  Missed after-hours bookings
                </div>
              </div>

              <div
                className="collapse-item p-8 backdrop-blur-sm"
                style={{
                  border: "1px solid var(--mm-border)",
                  background: "rgba(0, 180, 255, 0.03)",
                }}
              >
                <div
                  className="text-4xl md:text-5xl font-bold mb-2 font-mono"
                  style={{ color: "var(--mm-blue-core)" }}
                >
                  40 hrs
                </div>
                <div
                  style={{ color: "var(--mm-text-muted)" }}
                  className="text-sm uppercase tracking-wider"
                >
                  Wasted Monthly
                </div>
                <div
                  style={{ color: "var(--mm-text-subtle)" }}
                  className="text-xs mt-2"
                >
                  Answering repetitive questions
                </div>
              </div>

              <div
                className="collapse-item p-8 backdrop-blur-sm"
                style={{
                  border: "1px solid var(--mm-border)",
                  background: "rgba(0, 180, 255, 0.03)",
                }}
              >
                <div
                  className="text-4xl md:text-5xl font-bold mb-2 font-mono"
                  style={{ color: "var(--mm-blue-core)" }}
                >
                  23%
                </div>
                <div
                  style={{ color: "var(--mm-text-muted)" }}
                  className="text-sm uppercase tracking-wider"
                >
                  Leads Ignored
                </div>
                <div
                  style={{ color: "var(--mm-text-subtle)" }}
                  className="text-xs mt-2"
                >
                  Response time exceeds 5 min
                </div>
              </div>
            </div>

            {/* Counter */}
            <div
              className="collapse-item mb-12"
              style={{
                animation: isVisible
                  ? "float-up 0.6s ease-out 0.4s forwards, counter-pulse 2s ease-in-out infinite"
                  : "none",
                opacity: 0,
              }}
            >
              <div
                className="text-6xl md:text-8xl lg:text-9xl font-bold font-mono tracking-tight"
                style={{
                  color: "var(--mm-blue-bright)",
                  textShadow: "0 0 60px rgba(0, 212, 255, 0.5)",
                }}
              >
                {formatMoney(counter)}
              </div>
              <div
                className="text-2xl md:text-3xl mt-2"
                style={{ color: "var(--mm-text-muted)" }}
              >
                per year
              </div>
            </div>

            {/* The Gravity Button */}
            <button
              onClick={triggerGravity}
              className="collapse-item group relative px-12 py-6 font-bold text-lg md:text-xl uppercase tracking-[0.15em] transition-all duration-300 overflow-hidden"
              style={{
                background: "var(--mm-blue-core)",
                color: "var(--mm-void)",
                animation: isVisible
                  ? "float-up 0.6s ease-out 0.5s forwards, pulse-glow 2s ease-in-out infinite"
                  : "none",
                opacity: 0,
              }}
            >
              <span className="relative z-10 flex items-center gap-4">
                Watch It Collapse
                <svg
                  className="w-5 h-5 animate-bounce"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </span>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "var(--mm-blue-bright)" }}
              />
            </button>
          </div>
        )}

        {/* Overlay after collapse */}
        {showOverlay && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center"
            style={{
              background: "var(--mm-void)",
              animation: "fade-in 0.5s ease-out",
            }}
          >
            <div className="text-center max-w-4xl px-4">
              <div
                className="text-xl md:text-3xl mb-4 font-mono tracking-wide"
                style={{ color: "var(--mm-text-muted)" }}
              >
                That&apos;s {formatMoney(120000)} in lost revenue.
              </div>
              <div
                className="text-4xl md:text-6xl lg:text-8xl font-bold mb-4 font-heading"
                style={{ color: "var(--mm-text)" }}
              >
                Every. Single. Year.
              </div>
              <div
                className="text-xl mb-16"
                style={{ color: "var(--mm-text-subtle)" }}
              >
                Unless you have someone catching it 24/7.
              </div>

              {/* Sofia rises */}
              <div
                className="p-8 max-w-lg mx-auto backdrop-blur-sm"
                style={{
                  border: "1px solid var(--mm-border-hover)",
                  background: "rgba(0, 180, 255, 0.05)",
                  animation: "float-up 0.6s ease-out 0.3s forwards",
                  opacity: 0,
                }}
              >
                <div
                  className="text-sm font-mono uppercase tracking-[0.2em] mb-4 flex items-center justify-center gap-2"
                  style={{ color: "var(--mm-healthy)" }}
                >
                  <span className="w-2 h-2 rounded-full bg-[var(--mm-healthy)] animate-pulse" />
                  Sofia is Online
                </div>
                <div className="text-2xl text-white mb-4">
                  &quot;Hi! I can help you book that villa. Let me check
                  availability...&quot;
                </div>
                <div
                  className="text-sm font-mono"
                  style={{ color: "var(--mm-blue-core)" }}
                >
                  ✓ $450 booking closed at 11:47 PM
                </div>
              </div>

              <a
                href="#contact"
                className="inline-block mt-12 px-12 py-6 font-bold text-lg md:text-xl uppercase tracking-[0.15em] transition-all duration-300"
                style={{
                  background: "var(--mm-blue-core)",
                  color: "var(--mm-void)",
                  animation: "float-up 0.6s ease-out 0.5s forwards",
                  opacity: 0,
                }}
                onClick={() => setShowOverlay(false)}
              >
                Stop The Bleeding →
              </a>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

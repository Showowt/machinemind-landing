"use client";

import { useEffect, useRef } from "react";

/**
 * Horizontal Scroll Section
 * GSAP ScrollTrigger pinned horizontal scrolling
 */
export default function HorizontalScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const gsap = (window as unknown as { gsap?: unknown }).gsap;
    const ScrollTrigger = (window as unknown as { ScrollTrigger?: unknown })
      .ScrollTrigger;

    if (!gsap || !ScrollTrigger || !containerRef.current || !trackRef.current)
      return;

    const g = gsap as {
      registerPlugin: (p: unknown) => void;
      to: (
        t: unknown,
        c: object,
      ) => { scrollTrigger?: { kill: () => void } } | null;
    };
    const ST = ScrollTrigger as { create: (c: object) => { kill: () => void } };

    g.registerPlugin(ST);

    const track = trackRef.current;
    const panels = track.querySelectorAll(".h-panel");
    const totalWidth = (panels.length - 1) * window.innerWidth;

    const tween = g.to(track, {
      x: -totalWidth,
      ease: "none",
      scrollTrigger: {
        trigger: containerRef.current,
        pin: true,
        scrub: 1,
        end: () => "+=" + totalWidth,
      },
    });

    return () => {
      if (tween && tween.scrollTrigger) {
        tween.scrollTrigger.kill();
      }
    };
  }, []);

  const capabilities = [
    {
      title: "Sofia AI Concierge",
      subtitle: "24/7 Bilingual Intelligence",
      description:
        "Handles bookings, answers questions, closes sales while you sleep. Spanish and English fluency.",
      stat: "50K+",
      statLabel: "Conversations",
      color: "#00e5ff",
    },
    {
      title: "Autopoietic Systems",
      subtitle: "Self-Maintaining Architecture",
      description:
        "Systems that monitor, update, and heal themselves. Zero maintenance overhead for you.",
      stat: "99.9%",
      statLabel: "Uptime",
      color: "#8b5cf6",
    },
    {
      title: "Full-Stack Delivery",
      subtitle: "Design to Deployment",
      description:
        "From concept to production in weeks, not months. One team, no outsourcing, complete ownership.",
      stat: "6",
      statLabel: "Week Avg",
      color: "#10b981",
    },
    {
      title: "Revenue Recovery",
      subtitle: "Capture What You're Missing",
      description:
        "Every missed call, every after-hours inquiry, every slow response - converted to revenue.",
      stat: "$120K",
      statLabel: "Annual Recovery",
      color: "#f59e0b",
    },
  ];

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ height: "400vh" }}
    >
      <div
        ref={trackRef}
        className="flex h-screen"
        style={{ width: `${capabilities.length * 100}vw` }}
      >
        {capabilities.map((cap, i) => (
          <div
            key={i}
            className="h-panel w-screen h-screen flex-shrink-0 flex items-center justify-center px-8 md:px-20"
            style={{
              background: `radial-gradient(circle at 30% 50%, ${cap.color}10 0%, transparent 50%), #050510`,
            }}
          >
            <div className="max-w-4xl">
              <div
                className="text-sm font-mono uppercase tracking-wider mb-4"
                style={{ color: cap.color }}
              >
                0{i + 1} / 0{capabilities.length}
              </div>

              <h3
                className="font-heading text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-4"
                data-text="slide-up"
              >
                {cap.title}
              </h3>

              <p
                className="text-xl md:text-2xl mb-6"
                style={{ color: cap.color }}
              >
                {cap.subtitle}
              </p>

              <p
                className="text-gray-400 text-lg md:text-xl max-w-2xl mb-12"
                data-text="scroll-fade"
              >
                {cap.description}
              </p>

              <div className="flex items-end gap-4">
                <div
                  className="text-7xl md:text-9xl font-bold"
                  style={{ color: cap.color }}
                  data-velocity="letterspace"
                >
                  {cap.stat}
                </div>
                <div className="text-gray-500 text-sm uppercase tracking-wider pb-4">
                  {cap.statLabel}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress indicator */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-50">
        {capabilities.map((_, i) => (
          <div key={i} className="w-12 h-1 rounded-full bg-white/20" />
        ))}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Matter.js Gravity Collapse Section
 * The signature MachineMind "Gravity Pitch" effect
 */
export default function GravityCollapse() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const triggerGravity = () => {
    if (collapsed) return;
    setCollapsed(true);

    const Matter = (window as unknown as { Matter: typeof import("matter-js") })
      .Matter;
    if (!Matter) return;

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

    // Get elements to collapse
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

      // Store original styles
      el.dataset.origPosition = el.style.position;
      el.dataset.origTransform = el.style.transform;

      // Fix position
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

    // Show overlay after collapse
    setTimeout(() => {
      setShowOverlay(true);
    }, 1500);
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden py-20"
      style={{
        background: "linear-gradient(180deg, #050510 0%, #0a0a1a 100%)",
      }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,229,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,229,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      {!collapsed && (
        <div className="container-luxury relative z-10 text-center">
          {/* Pre-collapse content */}
          <div className="collapse-item mb-8">
            <span className="inline-block px-4 py-2 border border-red-500/30 text-red-400 text-sm font-mono uppercase tracking-wider">
              ⚠️ What You&apos;re Losing
            </span>
          </div>

          <h2
            className="collapse-item font-heading text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-8"
            data-text="slide-up"
          >
            Without AI Automation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            <div className="collapse-item p-8 border border-red-500/20 bg-red-500/5">
              <div className="text-5xl font-bold text-red-400 mb-2">$2,400</div>
              <div className="text-gray-400 text-sm">Lost Per Week</div>
              <div className="text-gray-500 text-xs mt-2">
                Missed after-hours bookings
              </div>
            </div>
            <div className="collapse-item p-8 border border-red-500/20 bg-red-500/5">
              <div className="text-5xl font-bold text-red-400 mb-2">40 hrs</div>
              <div className="text-gray-400 text-sm">Wasted Monthly</div>
              <div className="text-gray-500 text-xs mt-2">
                Answering repetitive questions
              </div>
            </div>
            <div className="collapse-item p-8 border border-red-500/20 bg-red-500/5">
              <div className="text-5xl font-bold text-red-400 mb-2">23%</div>
              <div className="text-gray-400 text-sm">Leads Ignored</div>
              <div className="text-gray-500 text-xs mt-2">
                Response time &gt; 5 minutes
              </div>
            </div>
          </div>

          <div className="collapse-item text-6xl md:text-8xl font-bold text-red-500 mb-8">
            $120,000
            <span className="text-2xl md:text-4xl text-red-400">/year</span>
          </div>

          {/* The Gravity Button */}
          <button
            onClick={triggerGravity}
            className="collapse-item group relative px-12 py-6 bg-red-600 hover:bg-red-500 text-white font-bold text-xl uppercase tracking-wider transition-all duration-300 overflow-hidden"
            data-magnetic="0.4"
          >
            <span
              data-magnetic-inner
              className="relative z-10 flex items-center gap-3"
            >
              <span>⬇️</span>
              Watch It Fall Apart
              <span>⬇️</span>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      )}

      {/* Overlay after collapse */}
      {showOverlay && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 animate-fade-in">
          <div className="text-center max-w-4xl px-4">
            <div
              className="text-2xl md:text-4xl text-red-400 mb-4 font-mono"
              data-text="scramble"
            >
              That&apos;s $120,000 falling through the floor.
            </div>
            <div
              className="text-4xl md:text-6xl lg:text-8xl font-bold text-white mb-8"
              data-text="slide-up"
            >
              Every. Single. Year.
            </div>
            <div className="text-xl text-gray-400 mb-12">
              Unless you have someone catching it 24/7.
            </div>

            {/* Sofia rises */}
            <div className="p-8 border border-emerald-500/30 bg-emerald-500/10 rounded-none max-w-md mx-auto animate-fade-in-up">
              <div className="text-emerald-400 text-sm font-mono uppercase tracking-wider mb-4">
                🟢 Sofia is Online
              </div>
              <div className="text-2xl text-white mb-2">
                &quot;Hi! I can help you book that villa. Let me check
                availability...&quot;
              </div>
              <div className="text-emerald-300 text-sm">
                ✓ $450 booking closed at 11:47 PM
              </div>
            </div>

            <button
              onClick={() => (window.location.href = "#contact")}
              className="mt-12 px-12 py-6 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xl uppercase tracking-wider transition-all"
              data-magnetic="0.3"
            >
              <span data-magnetic-inner>Talk to Sofia Now →</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

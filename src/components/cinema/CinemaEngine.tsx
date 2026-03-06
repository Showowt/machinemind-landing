"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Script from "next/script";

// Type declarations for CDN libraries
declare global {
  interface Window {
    Lenis: new (config: {
      lerp?: number;
      duration?: number;
      smoothWheel?: boolean;
      wheelMultiplier?: number;
      touchMultiplier?: number;
      infinite?: boolean;
      orientation?: "vertical" | "horizontal";
      gestureOrientation?: "vertical" | "horizontal" | "both";
      easing?: (t: number) => number;
    }) => LenisInstance;
    gsap: GSAPInstance;
    ScrollTrigger: ScrollTriggerStatic;
    SplitType: new (
      element: Element,
      options: { types?: string; tagName?: string }
    ) => SplitTypeInstance;
    lenis: LenisInstance | null;
  }
}

interface LenisInstance {
  raf: (time: number) => void;
  scroll: number;
  scrollTo: (
    target: number | string | HTMLElement,
    options?: { offset?: number; duration?: number; immediate?: boolean }
  ) => void;
  on: (event: string, callback: (e: { scroll: number; velocity: number; direction: number }) => void) => void;
  off: (event: string, callback: (e: { scroll: number; velocity: number; direction: number }) => void) => void;
  destroy: () => void;
  start: () => void;
  stop: () => void;
}

interface GSAPInstance {
  registerPlugin: (...plugins: unknown[]) => void;
  ticker: {
    add: (callback: (time: number) => void) => void;
    remove: (callback: (time: number) => void) => void;
    lagSmoothing: (threshold: number, adjustedLag?: number) => void;
  };
  to: (
    target: Element | Element[] | NodeListOf<Element> | string,
    vars: Record<string, unknown>
  ) => GSAPTween;
  fromTo: (
    target: Element | Element[] | NodeListOf<Element>,
    fromVars: Record<string, unknown>,
    toVars: Record<string, unknown>
  ) => GSAPTween;
  set: (
    target: Element | Element[] | NodeListOf<Element>,
    vars: Record<string, unknown>
  ) => void;
  timeline: (config?: Record<string, unknown>) => GSAPTimeline;
  quickTo: (
    target: Element,
    property: string,
    vars: Record<string, unknown>
  ) => (value: number) => void;
  utils: {
    random: (min: number, max: number, snap?: number) => number;
    mapRange: (
      inMin: number,
      inMax: number,
      outMin: number,
      outMax: number,
      value: number
    ) => number;
  };
}

interface GSAPTween {
  kill: () => void;
  progress: (value?: number) => number | GSAPTween;
}

interface GSAPTimeline {
  to: (
    target: Element | Element[],
    vars: Record<string, unknown>,
    position?: string | number
  ) => GSAPTimeline;
  fromTo: (
    target: Element | Element[],
    fromVars: Record<string, unknown>,
    toVars: Record<string, unknown>,
    position?: string | number
  ) => GSAPTimeline;
  kill: () => void;
}

interface ScrollTriggerStatic {
  create: (config: Record<string, unknown>) => ScrollTriggerInstance;
  update: () => void;
  scrollerProxy: (
    scroller: string | Element | Document | typeof document.body,
    config: {
      scrollTop: (value?: number) => number | void;
      getBoundingClientRect: () => {
        top: number;
        left: number;
        width: number;
        height: number;
      };
      pinType?: string;
    }
  ) => void;
  addEventListener: (
    event: string,
    callback: (trigger: ScrollTriggerInstance) => void
  ) => void;
  removeEventListener: (
    event: string,
    callback: (trigger: ScrollTriggerInstance) => void
  ) => void;
  refresh: (safe?: boolean) => void;
  defaults: (config: Record<string, unknown>) => void;
}

interface ScrollTriggerInstance {
  kill: () => void;
  progress: number;
  getVelocity: () => number;
}

interface SplitTypeInstance {
  words: Element[] | null;
  chars: Element[] | null;
  lines: Element[] | null;
  revert: () => void;
}

interface CinemaEngineProps {
  brandName?: string;
  accentColor?: string;
  skipPreloader?: boolean;
  sound?: boolean;
}

/**
 * MachineMind Cinema Engine v2.1
 * 25-Layer Cinematic Web Experience
 *
 * SMOOTH SCROLL CONFIG (Butter-smooth cinematic feel):
 * - lerp: 0.07 (cinematic smooth interpolation)
 * - duration: 1.2 (scroll momentum duration)
 * - smoothWheel: true
 * - Connected to GSAP ticker for perfect sync
 * - ScrollTrigger.update on every scroll frame
 * - window.lenis exposed globally
 *
 * Features activated via data-* attributes:
 * - data-text="slide-up|rotate-in|scroll-fade|scramble|wave|chars-up"
 * - data-velocity="skew|blur|stretch|opacity|letterspace|rgb-split"
 * - data-magnetic="0.3" + data-magnetic-inner
 * - data-reveal + data-reveal-item
 * - data-progress-bar (scroll progress indicator)
 */
export default function CinemaEngine({
  accentColor = "#00e5ff",
}: CinemaEngineProps) {
  const initialized = useRef(false);
  const lenisRef = useRef<LenisInstance | null>(null);
  const scrollTriggersRef = useRef<ScrollTriggerInstance[]>([]);
  const splitInstancesRef = useRef<SplitTypeInstance[]>([]);
  const magneticCleanupRef = useRef<Array<() => void>>([]);
  const rafCallbackRef = useRef<((time: number) => void) | null>(null);
  const scrollListenerRef = useRef<((e: { scroll: number; velocity: number; direction: number }) => void) | null>(null);

  useEffect(() => {
    const initCinema = () => {
      if (typeof window === "undefined" || initialized.current) return;
      if (!window.gsap || !window.ScrollTrigger || !window.Lenis) {
        console.warn("[Cinema Engine] Dependencies not loaded yet");
        return;
      }

      initialized.current = true;
      console.log("[Cinema Engine v2.1] Initializing cinematic smooth scroll...");

      const gsap = window.gsap;
      const ScrollTrigger = window.ScrollTrigger;
      const Lenis = window.Lenis;
      const SplitType = window.SplitType;

      // Register GSAP plugins
      gsap.registerPlugin(ScrollTrigger);

      // ============================================
      // 1. LENIS SMOOTH SCROLL (BUTTER-SMOOTH CONFIG)
      // ============================================
      const lenis = new Lenis({
        lerp: 0.07, // Cinematic smooth interpolation (lower = smoother)
        duration: 1.2, // Scroll momentum duration
        smoothWheel: true, // Smooth mousewheel scrolling
        wheelMultiplier: 1, // Wheel sensitivity
        touchMultiplier: 2, // Touch sensitivity for mobile
        infinite: false, // No infinite scroll
        orientation: "vertical", // Vertical scrolling
        gestureOrientation: "vertical", // Touch gesture direction
        // Cinematic easing curve - exponential decay for natural deceleration
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });

      lenisRef.current = lenis;

      // EXPOSE GLOBALLY for external access
      window.lenis = lenis;

      // Connect Lenis to GSAP ticker for buttery-smooth animation sync
      const rafCallback = (time: number) => {
        lenis.raf(time * 1000);
      };
      rafCallbackRef.current = rafCallback;
      gsap.ticker.add(rafCallback);

      // Disable GSAP lag smoothing for consistent frame timing
      gsap.ticker.lagSmoothing(0);

      // ScrollTrigger scroller proxy for Lenis integration
      ScrollTrigger.scrollerProxy(document.documentElement, {
        scrollTop(value?: number) {
          if (arguments.length && value !== undefined) {
            lenis.scrollTo(value, { immediate: true });
            return value;
          }
          return lenis.scroll;
        },
        getBoundingClientRect() {
          return {
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: window.innerHeight,
          };
        },
        pinType: document.documentElement.style.transform ? "transform" : "fixed",
      });

      // Connect scroll events to ScrollTrigger
      const scrollListener = () => {
        ScrollTrigger.update();
      };
      scrollListenerRef.current = scrollListener;
      lenis.on("scroll", scrollListener);

      // Set ScrollTrigger defaults
      ScrollTrigger.defaults({
        scroller: document.documentElement,
      });

      console.log("[Cinema Engine v2.1] Lenis smooth scroll initialized:", {
        lerp: 0.07,
        duration: 1.2,
        easing: "exponential-decay",
        gsapSync: true,
        scrollTriggerProxy: true,
        globalAccess: "window.lenis",
      });

      // ============================================
      // 2. TEXT ANIMATIONS (SplitType + GSAP)
      // ============================================

      // 2a. SLIDE-UP: Words slide up with skewY
      document
        .querySelectorAll('[data-text="slide-up"]')
        .forEach((element) => {
          if (!SplitType) return;
          const split = new SplitType(element, {
            types: "words",
            tagName: "span",
          });
          splitInstancesRef.current.push(split);

          if (split.words) {
            gsap.set(split.words, {
              yPercent: 110,
              skewY: 7,
              opacity: 0,
            });

            const trigger = ScrollTrigger.create({
              trigger: element,
              start: "top 85%",
              once: true,
              onEnter: () => {
                gsap.to(split.words as Element[], {
                  yPercent: 0,
                  skewY: 0,
                  opacity: 1,
                  duration: 1,
                  ease: "power3.out",
                  stagger: 0.05,
                });
              },
            });
            scrollTriggersRef.current.push(trigger);
          }
        });

      // 2b. SCRAMBLE: Random chars decode to final text
      document
        .querySelectorAll('[data-text="scramble"]')
        .forEach((element) => {
          const el = element as HTMLElement;
          const originalText = el.textContent || "";
          const chars = "!<>-_\\/[]{}--=+*^?#________";

          const trigger = ScrollTrigger.create({
            trigger: element,
            start: "top 85%",
            once: true,
            onEnter: () => {
              let iteration = 0;
              const interval = setInterval(() => {
                el.textContent = originalText
                  .split("")
                  .map((char, index) => {
                    if (index < iteration) return originalText[index];
                    return chars[Math.floor(Math.random() * chars.length)];
                  })
                  .join("");

                iteration += 1 / 3;
                if (iteration >= originalText.length) {
                  el.textContent = originalText;
                  clearInterval(interval);
                }
              }, 30);
            },
          });
          scrollTriggersRef.current.push(trigger);
        });

      // 2c. SCROLL-FADE: Words illuminate on scroll (opacity 0.08 -> 1)
      document
        .querySelectorAll('[data-text="scroll-fade"]')
        .forEach((element) => {
          if (!SplitType) return;
          const split = new SplitType(element, {
            types: "words",
            tagName: "span",
          });
          splitInstancesRef.current.push(split);

          if (split.words) {
            gsap.set(split.words, { opacity: 0.08 });

            const trigger = ScrollTrigger.create({
              trigger: element,
              start: "top 80%",
              end: "bottom 20%",
              scrub: true,
              onUpdate: (self: ScrollTriggerInstance) => {
                const words = split.words as Element[];
                const progress = self.progress;
                words.forEach((word, i) => {
                  const wordProgress = Math.max(
                    0,
                    Math.min(1, (progress - i / words.length) * words.length)
                  );
                  gsap.set(word, { opacity: 0.08 + wordProgress * 0.92 });
                });
              },
            });
            scrollTriggersRef.current.push(trigger);
          }
        });

      // 2d. ROTATE-IN: Chars rotate on Y axis with perspective
      document
        .querySelectorAll('[data-text="rotate-in"]')
        .forEach((element) => {
          if (!SplitType) return;
          const el = element as HTMLElement;
          el.style.perspective = "1000px";

          const split = new SplitType(element, {
            types: "chars",
            tagName: "span",
          });
          splitInstancesRef.current.push(split);

          if (split.chars) {
            gsap.set(split.chars, {
              rotateY: 90,
              opacity: 0,
              transformOrigin: "left center",
            });

            const trigger = ScrollTrigger.create({
              trigger: element,
              start: "top 85%",
              once: true,
              onEnter: () => {
                gsap.to(split.chars as Element[], {
                  rotateY: 0,
                  opacity: 1,
                  duration: 0.8,
                  ease: "power2.out",
                  stagger: 0.02,
                });
              },
            });
            scrollTriggersRef.current.push(trigger);
          }
        });

      // 2e. WAVE: Sine-wave Y offset stagger on chars
      document.querySelectorAll('[data-text="wave"]').forEach((element) => {
        if (!SplitType) return;
        const split = new SplitType(element, {
          types: "chars",
          tagName: "span",
        });
        splitInstancesRef.current.push(split);

        if (split.chars) {
          const chars = split.chars as Element[];

          const trigger = ScrollTrigger.create({
            trigger: element,
            start: "top 85%",
            end: "bottom 15%",
            scrub: 0.5,
            onUpdate: (self: ScrollTriggerInstance) => {
              chars.forEach((char, i) => {
                const offset = Math.sin(self.progress * Math.PI * 2 + i * 0.3);
                gsap.set(char, { y: offset * 10 });
              });
            },
          });
          scrollTriggersRef.current.push(trigger);
        }
      });

      // 2f. CHARS-UP: Individual chars slide up
      document
        .querySelectorAll('[data-text="chars-up"]')
        .forEach((element) => {
          if (!SplitType) return;
          const split = new SplitType(element, {
            types: "chars",
            tagName: "span",
          });
          splitInstancesRef.current.push(split);

          if (split.chars) {
            gsap.set(split.chars, { yPercent: 100, opacity: 0 });

            const trigger = ScrollTrigger.create({
              trigger: element,
              start: "top 85%",
              once: true,
              onEnter: () => {
                gsap.to(split.chars as Element[], {
                  yPercent: 0,
                  opacity: 1,
                  duration: 0.6,
                  ease: "power2.out",
                  stagger: 0.015,
                });
              },
            });
            scrollTriggersRef.current.push(trigger);
          }
        });

      // ============================================
      // 3. VELOCITY SCROLL TRACKER
      // ============================================
      let scrollVelocity = 0;

      ScrollTrigger.addEventListener(
        "scrollStart",
        (trigger: ScrollTriggerInstance) => {
          scrollVelocity = trigger.getVelocity();
        }
      );

      // Update velocity on scroll
      const velocityTrigger = ScrollTrigger.create({
        onUpdate: (self: ScrollTriggerInstance) => {
          scrollVelocity = self.getVelocity();

          // Normalize velocity (typical range -2000 to 2000)
          const normalizedVelocity = Math.min(
            Math.abs(scrollVelocity) / 2000,
            1
          );
          const direction = scrollVelocity > 0 ? 1 : -1;

          // Apply velocity effects
          document
            .querySelectorAll('[data-velocity="skew"]')
            .forEach((el) => {
              gsap.to(el, {
                skewY: direction * normalizedVelocity * 10,
                duration: 0.3,
                ease: "power2.out",
              });
            });

          document
            .querySelectorAll('[data-velocity="blur"]')
            .forEach((el) => {
              const blur = normalizedVelocity * 4;
              gsap.to(el, {
                filter: "blur(" + blur + "px)",
                duration: 0.3,
                ease: "power2.out",
              });
            });

          document
            .querySelectorAll('[data-velocity="stretch"]')
            .forEach((el) => {
              gsap.to(el, {
                scaleY: 1 + normalizedVelocity * 0.15,
                duration: 0.3,
                ease: "power2.out",
              });
            });

          document
            .querySelectorAll('[data-velocity="letterspace"]')
            .forEach((el) => {
              gsap.to(el, {
                letterSpacing: normalizedVelocity * 10 + "px",
                duration: 0.3,
                ease: "power2.out",
              });
            });

          document
            .querySelectorAll('[data-velocity="rgb-split"]')
            .forEach((el) => {
              const offset = normalizedVelocity * 3;
              gsap.to(el, {
                textShadow: offset + "px 0 rgba(255,0,0,0.7), " + (-offset) + "px 0 rgba(0,255,255,0.7)",
                duration: 0.3,
                ease: "power2.out",
              });
            });

          document
            .querySelectorAll('[data-velocity="opacity"]')
            .forEach((el) => {
              gsap.to(el, {
                opacity: 1 - normalizedVelocity * 0.5,
                duration: 0.3,
                ease: "power2.out",
              });
            });
        },
      });
      scrollTriggersRef.current.push(velocityTrigger);

      // Reset velocity effects when scroll stops
      let scrollTimeout: ReturnType<typeof setTimeout>;
      const resetVelocity = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          document.querySelectorAll("[data-velocity]").forEach((el) => {
            gsap.to(el, {
              skewY: 0,
              scaleY: 1,
              filter: "blur(0px)",
              letterSpacing: "0px",
              textShadow: "none",
              opacity: 1,
              duration: 0.5,
              ease: "elastic.out(1, 0.5)",
            });
          });
        }, 150);
      };
      window.addEventListener("scroll", resetVelocity, { passive: true });

      // ============================================
      // 4. MAGNETIC ELEMENTS
      // ============================================
      document.querySelectorAll("[data-magnetic]").forEach((element) => {
        const el = element as HTMLElement;
        const strength = parseFloat(el.dataset.magnetic || "0.3");
        const inner = el.querySelector("[data-magnetic-inner]") as HTMLElement;

        const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });

        let innerXTo: ((value: number) => void) | null = null;
        let innerYTo: ((value: number) => void) | null = null;

        if (inner) {
          innerXTo = gsap.quickTo(inner, "x", {
            duration: 0.6,
            ease: "power3.out",
          });
          innerYTo = gsap.quickTo(inner, "y", {
            duration: 0.6,
            ease: "power3.out",
          });
        }

        const handleMouseMove = (e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dx = e.clientX - centerX;
          const dy = e.clientY - centerY;

          xTo(dx * strength);
          yTo(dy * strength);

          if (inner && innerXTo && innerYTo) {
            innerXTo(dx * strength * 0.5);
            innerYTo(dy * strength * 0.5);
          }
        };

        const handleMouseLeave = () => {
          gsap.to(el, {
            x: 0,
            y: 0,
            duration: 0.8,
            ease: "elastic.out(1, 0.3)",
          });

          if (inner) {
            gsap.to(inner, {
              x: 0,
              y: 0,
              duration: 0.8,
              ease: "elastic.out(1, 0.3)",
            });
          }
        };

        el.addEventListener("mousemove", handleMouseMove);
        el.addEventListener("mouseleave", handleMouseLeave);

        magneticCleanupRef.current.push(() => {
          el.removeEventListener("mousemove", handleMouseMove);
          el.removeEventListener("mouseleave", handleMouseLeave);
        });
      });

      // ============================================
      // 5. PROGRESS BAR (Gold -> Cyan gradient)
      // ============================================
      const progressBar = document.querySelector(
        "[data-progress-bar]"
      ) as HTMLElement;
      if (progressBar) {
        progressBar.style.background = "linear-gradient(90deg, #d4af37, " + accentColor + ")";
        progressBar.style.transformOrigin = "left center";
        progressBar.style.position = "fixed";
        progressBar.style.top = "0";
        progressBar.style.left = "0";
        progressBar.style.height = "3px";
        progressBar.style.width = "100%";
        progressBar.style.zIndex = "9999";

        gsap.set(progressBar, { scaleX: 0 });

        const progressTrigger = ScrollTrigger.create({
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self: ScrollTriggerInstance) => {
            gsap.set(progressBar, { scaleX: self.progress });
          },
        });
        scrollTriggersRef.current.push(progressTrigger);
      }

      // ============================================
      // 6. REVEAL ANIMATIONS
      // ============================================
      document.querySelectorAll("[data-reveal]").forEach((container) => {
        const variant = (container as HTMLElement).dataset.reveal || "default";
        const items = container.querySelectorAll("[data-reveal-item]");

        if (items.length === 0) {
          // Animate container itself
          if (variant === "scale") {
            gsap.set(container, { scale: 0.8, opacity: 0 });
          } else if (variant === "clip") {
            gsap.set(container, { clipPath: "inset(100% 0 0 0)", opacity: 0 });
          } else {
            gsap.set(container, { y: 60, opacity: 0 });
          }

          const trigger = ScrollTrigger.create({
            trigger: container,
            start: "top 85%",
            once: true,
            onEnter: () => {
              if (variant === "scale") {
                gsap.to(container, {
                  scale: 1,
                  opacity: 1,
                  duration: 0.8,
                  ease: "back.out(1.7)",
                });
              } else if (variant === "clip") {
                gsap.to(container, {
                  clipPath: "inset(0% 0 0 0)",
                  opacity: 1,
                  duration: 1,
                  ease: "power3.inOut",
                });
              } else {
                gsap.to(container, {
                  y: 0,
                  opacity: 1,
                  duration: 0.8,
                  ease: "power3.out",
                });
              }
            },
          });
          scrollTriggersRef.current.push(trigger);
        } else {
          // Animate child items with stagger
          gsap.set(items, { y: 40, opacity: 0 });

          const trigger = ScrollTrigger.create({
            trigger: container,
            start: "top 85%",
            once: true,
            onEnter: () => {
              gsap.to(items, {
                y: 0,
                opacity: 1,
                duration: 0.6,
                ease: "power3.out",
                stagger: 0.1,
              });
            },
          });
          scrollTriggersRef.current.push(trigger);
        }
      });

      // ============================================
      // REFRESH SCROLL TRIGGER (with delay for DOM settling)
      // ============================================
      requestAnimationFrame(() => {
        ScrollTrigger.refresh(true);
      });

      console.log("[Cinema Engine v2.1] All effects initialized successfully");
    };

    // Check if scripts are loaded
    const checkScripts = () => {
      return !!(
        typeof window !== "undefined" &&
        window.gsap &&
        window.ScrollTrigger &&
        window.Lenis
      );
    };

    if (checkScripts()) {
      initCinema();
    }

    // Listen for script load event
    const handleScriptsLoaded = () => {
      if (checkScripts()) {
        initCinema();
      }
    };
    window.addEventListener("cinema:scriptsLoaded", handleScriptsLoaded);

    // Cleanup
    return () => {
      window.removeEventListener("cinema:scriptsLoaded", handleScriptsLoaded);

      // Kill all ScrollTriggers
      scrollTriggersRef.current.forEach((trigger) => trigger.kill());
      scrollTriggersRef.current = [];

      // Revert all SplitType instances
      splitInstancesRef.current.forEach((split) => split.revert());
      splitInstancesRef.current = [];

      // Remove magnetic listeners
      magneticCleanupRef.current.forEach((cleanup) => cleanup());
      magneticCleanupRef.current = [];

      // Remove scroll listener from Lenis
      if (lenisRef.current && scrollListenerRef.current) {
        lenisRef.current.off("scroll", scrollListenerRef.current);
        scrollListenerRef.current = null;
      }

      // Destroy Lenis
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }

      // Clear global reference
      if (typeof window !== "undefined") {
        window.lenis = null;
      }

      // Remove GSAP ticker callback
      if (rafCallbackRef.current && window.gsap) {
        window.gsap.ticker.remove(rafCallbackRef.current);
        rafCallbackRef.current = null;
      }

      initialized.current = false;
    };
  }, [accentColor]);

  // Script load counter
  const scriptsLoaded = useRef(0);
  const totalScripts = 8;

  const handleScriptLoad = () => {
    scriptsLoaded.current += 1;
    if (scriptsLoaded.current >= totalScripts) {
      window.dispatchEvent(new CustomEvent("cinema:scriptsLoaded"));
    }
  };

  return (
    <>
      {/* Progress Bar Element */}
      <div data-progress-bar aria-hidden="true" />

      {/* CDN Dependencies */}
      <Script
        src="https://unpkg.com/lenis@1.1.18/dist/lenis.min.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://unpkg.com/split-type@0.3.4"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
      />
    </>
  );
}

// ============================================
// EXPORT CINEMA-AWARE WRAPPER COMPONENTS
// ============================================

export function CinemaText({
  children,
  effect = "slide-up",
  className = "",
}: {
  children: ReactNode;
  effect?:
    | "slide-up"
    | "rotate-in"
    | "scroll-fade"
    | "scramble"
    | "wave"
    | "chars-up";
  className?: string;
}) {
  return (
    <div className={className} data-text={effect}>
      {children}
    </div>
  );
}

export function CinemaVelocity({
  children,
  effect = "skew",
  className = "",
}: {
  children: ReactNode;
  effect?:
    | "skew"
    | "blur"
    | "stretch"
    | "opacity"
    | "letterspace"
    | "rgb-split";
  className?: string;
}) {
  return (
    <div className={className} data-velocity={effect}>
      {children}
    </div>
  );
}

export function MagneticButton({
  children,
  strength = 0.3,
  className = "",
  href,
  onClick,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = <span data-magnetic-inner>{children}</span>;

  if (href) {
    return (
      <a href={href} className={className} data-magnetic={strength}>
        {content}
      </a>
    );
  }

  return (
    <button className={className} onClick={onClick} data-magnetic={strength}>
      {content}
    </button>
  );
}

export function CinemaReveal({
  children,
  variant = "default",
  className = "",
}: {
  children: ReactNode;
  variant?: "default" | "scale" | "clip";
  className?: string;
}) {
  if (variant === "default") {
    return (
      <div className={className} data-reveal="">
        {children}
      </div>
    );
  }
  return (
    <div className={className} data-reveal={variant}>
      {children}
    </div>
  );
}

export function CinemaRevealItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className} data-reveal-item="">
      {children}
    </div>
  );
}

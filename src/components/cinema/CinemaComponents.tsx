// ═══════════════════════════════════════════════════════════════
// MACHINEMIND CINEMA ENGINE — TSX COMPONENT LIBRARY
// Drop this entire file in: /components/cinema/CinemaComponents.tsx
// Import from here in every project. Claude Code copies, not interprets.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

// ─── DESIGN TOKENS ───────────────────────────────────────────
export const CINEMA = {
  colors: {
    void: "#000000",
    surface: "#0a0a0a",
    elevated: "#111111",
    border: "rgba(255,255,255,0.06)",
    gold: "#c9a96e",
    goldBright: "#d4b87a",
    goldDim: "rgba(201,169,110,0.3)",
    cyan: "#00e5ff",
    white: "#FFFFFF",
    muted: "rgba(255,255,255,0.4)",
  },
  fonts: {
    display: "var(--font-heading), 'Clash Display', sans-serif",
    body: "var(--font-body), 'Satoshi', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  timing: {
    fast: "200ms",
    normal: "400ms",
    slow: "600ms",
    cinematic: "1200ms",
  },
};

// ─── PRELOADER ────────────────────────────────────────────────
interface PreloaderProps {
  logo?: string;
  onComplete?: () => void;
  duration?: number;
}

export function CinemaPreloader({
  logo = "MM",
  onComplete,
  duration = 2000,
}: PreloaderProps) {
  const [phase, setPhase] = useState<"loading" | "reveal" | "exit">("loading");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const increment = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(increment);
          return 100;
        }
        return p + 2;
      });
    }, duration / 50);

    const reveal = setTimeout(() => setPhase("reveal"), duration * 0.6);
    const exit = setTimeout(() => {
      setPhase("exit");
      setTimeout(() => onComplete?.(), 600);
    }, duration);

    return () => {
      clearInterval(increment);
      clearTimeout(reveal);
      clearTimeout(exit);
    };
  }, [duration, onComplete]);

  if (phase === "exit") return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: CINEMA.colors.void,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: 1,
        transition: "opacity 600ms ease",
      }}
    >
      {/* Logo */}
      <div
        style={{
          fontFamily: CINEMA.fonts.display,
          fontSize: "3rem",
          fontWeight: 700,
          color: CINEMA.colors.gold,
          letterSpacing: "0.3em",
          opacity: phase === "reveal" ? 1 : 0,
          transform: phase === "reveal" ? "translateY(0)" : "translateY(20px)",
          transition: "all 800ms ease",
          marginBottom: "2rem",
        }}
      >
        {logo}
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: "200px",
          height: "1px",
          background: "rgba(255,255,255,0.1)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${progress}%`,
            background: `linear-gradient(90deg, transparent, ${CINEMA.colors.gold}, transparent)`,
            transition: "width 50ms linear",
          }}
        />
      </div>
    </div>
  );
}

// ─── SCROLL REVEAL ────────────────────────────────────────────
interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
}

export function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  className,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  const transforms = {
    up: "translateY(40px)",
    down: "translateY(-40px)",
    left: "translateX(40px)",
    right: "translateX(-40px)",
    none: "none",
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : transforms[direction],
        transition: `opacity 600ms ease ${delay}ms, transform 600ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── GOLD BUTTON ──────────────────────────────────────────────
interface GoldButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  target?: string;
  rel?: string;
}

export function GoldButton({
  children,
  onClick,
  href,
  variant = "solid",
  size = "md",
  disabled = false,
  className,
  target,
  rel,
}: GoldButtonProps) {
  const [hovered, setHovered] = useState(false);

  const sizes = {
    sm: { padding: "8px 20px", fontSize: "0.8rem" },
    md: { padding: "12px 32px", fontSize: "0.9rem" },
    lg: { padding: "16px 48px", fontSize: "1rem" },
  };

  const styles = {
    solid: {
      background: hovered
        ? `linear-gradient(135deg, ${CINEMA.colors.goldBright}, ${CINEMA.colors.gold})`
        : `linear-gradient(135deg, ${CINEMA.colors.gold}, #a8894a)`,
      color: CINEMA.colors.void,
      border: "none",
      boxShadow: hovered ? `0 0 30px ${CINEMA.colors.goldDim}` : "none",
    },
    outline: {
      background: hovered ? CINEMA.colors.goldDim : "transparent",
      color: CINEMA.colors.gold,
      border: `1px solid ${CINEMA.colors.gold}`,
      boxShadow: hovered ? `0 0 20px ${CINEMA.colors.goldDim}` : "none",
    },
    ghost: {
      background: "transparent",
      color: hovered ? CINEMA.colors.gold : CINEMA.colors.muted,
      border: "none",
      boxShadow: "none",
    },
  };

  const baseStyle: React.CSSProperties = {
    ...sizes[size],
    ...styles[variant],
    fontFamily: CINEMA.fonts.body,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: "all 300ms ease",
    borderRadius: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    textDecoration: "none",
    minHeight: size === "lg" ? "56px" : size === "md" ? "48px" : "40px",
  };

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        style={baseStyle}
        className={className}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={baseStyle}
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

// ─── HERO SECTION ─────────────────────────────────────────────
interface CinemaHeroProps {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  ctaSecondary?: { label: string; href?: string; onClick?: () => void };
  children?: ReactNode;
}

export function CinemaHero({
  eyebrow,
  headline,
  subheadline,
  cta,
  ctaSecondary,
  children,
}: CinemaHeroProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      style={{
        minHeight: "100vh",
        background: CINEMA.colors.void,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "120px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient gradient */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "600px",
          background: `radial-gradient(circle, ${CINEMA.colors.goldDim} 0%, transparent 70%)`,
          pointerEvents: "none",
          opacity: mounted ? 1 : 0,
          transition: "opacity 2000ms ease",
        }}
      />

      <div
        style={{
          textAlign: "center",
          maxWidth: "900px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Eyebrow */}
        {eyebrow && (
          <div
            style={{
              fontFamily: CINEMA.fonts.mono,
              fontSize: "0.7rem",
              letterSpacing: "0.4em",
              color: CINEMA.colors.gold,
              textTransform: "uppercase",
              marginBottom: "1.5rem",
              opacity: mounted ? 1 : 0,
              transition: "opacity 600ms ease 200ms",
            }}
          >
            {eyebrow}
          </div>
        )}

        {/* Headline */}
        <h1
          style={{
            fontFamily: CINEMA.fonts.display,
            fontSize: "clamp(3rem, 8vw, 7rem)",
            fontWeight: 700,
            color: CINEMA.colors.white,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            marginBottom: "1.5rem",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "none" : "translateY(30px)",
            transition: "all 800ms ease 400ms",
          }}
        >
          {headline}
        </h1>

        {/* Subheadline */}
        {subheadline && (
          <p
            style={{
              fontFamily: CINEMA.fonts.body,
              fontSize: "1.1rem",
              color: CINEMA.colors.muted,
              lineHeight: 1.7,
              maxWidth: "600px",
              margin: "0 auto 3rem",
              opacity: mounted ? 1 : 0,
              transition: "opacity 600ms ease 700ms",
            }}
          >
            {subheadline}
          </p>
        )}

        {/* CTAs */}
        {(cta || ctaSecondary) && (
          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              flexWrap: "wrap",
              opacity: mounted ? 1 : 0,
              transition: "opacity 600ms ease 900ms",
            }}
          >
            {cta && (
              <GoldButton href={cta.href} onClick={cta.onClick} size="lg">
                {cta.label}
              </GoldButton>
            )}
            {ctaSecondary && (
              <GoldButton
                href={ctaSecondary.href}
                onClick={ctaSecondary.onClick}
                size="lg"
                variant="outline"
              >
                {ctaSecondary.label}
              </GoldButton>
            )}
          </div>
        )}

        {/* Custom children */}
        {children}
      </div>
    </section>
  );
}

// ─── GOLD DIVIDER ─────────────────────────────────────────────
export function GoldDivider({ label }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0 24px",
      }}
    >
      <div
        style={{ flex: 1, height: "1px", background: CINEMA.colors.border }}
      />
      {label && (
        <span
          style={{
            fontFamily: CINEMA.fonts.mono,
            fontSize: "0.65rem",
            letterSpacing: "0.3em",
            color: CINEMA.colors.gold,
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{ flex: 1, height: "1px", background: CINEMA.colors.border }}
      />
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────
interface StatCardProps {
  value: string;
  label: string;
  prefix?: string;
  suffix?: string;
}

export function StatCard({ value, label, prefix, suffix }: StatCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "2rem",
        border: `1px solid ${hovered ? CINEMA.colors.gold : CINEMA.colors.border}`,
        background: hovered ? "rgba(201,169,110,0.03)" : CINEMA.colors.surface,
        transition: "all 300ms ease",
        textAlign: "center",
        cursor: "default",
        boxShadow: hovered ? `0 0 30px ${CINEMA.colors.goldDim}` : "none",
      }}
    >
      <div
        style={{
          fontFamily: CINEMA.fonts.display,
          fontSize: "3.5rem",
          fontWeight: 700,
          color: CINEMA.colors.gold,
          lineHeight: 1,
          marginBottom: "0.5rem",
        }}
      >
        {prefix}
        {value}
        {suffix}
      </div>
      <div
        style={{
          fontFamily: CINEMA.fonts.body,
          fontSize: "0.75rem",
          letterSpacing: "0.2em",
          color: CINEMA.colors.muted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── FEATURE CARD ─────────────────────────────────────────────
interface FeatureCardProps {
  icon?: string;
  title: string;
  description: string;
  delay?: number;
}

export function FeatureCard({
  icon,
  title,
  description,
  delay = 0,
}: FeatureCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <ScrollReveal delay={delay}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "2rem",
          border: `1px solid ${hovered ? "rgba(201,169,110,0.3)" : CINEMA.colors.border}`,
          background: hovered
            ? "rgba(201,169,110,0.02)"
            : CINEMA.colors.surface,
          transition: "all 400ms ease",
          height: "100%",
        }}
      >
        {icon && (
          <div
            style={{
              fontSize: "1.5rem",
              marginBottom: "1rem",
              opacity: 0.8,
            }}
          >
            {icon}
          </div>
        )}
        <h3
          style={{
            fontFamily: CINEMA.fonts.display,
            fontSize: "1.2rem",
            fontWeight: 600,
            color: CINEMA.colors.white,
            marginBottom: "0.75rem",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontFamily: CINEMA.fonts.body,
            fontSize: "0.9rem",
            color: CINEMA.colors.muted,
            lineHeight: 1.7,
          }}
        >
          {description}
        </p>
      </div>
    </ScrollReveal>
  );
}

// ─── SECTION WRAPPER ──────────────────────────────────────────
interface SectionProps {
  children: ReactNode;
  id?: string;
  background?: string;
  padding?: string;
  className?: string;
}

export function Section({
  children,
  id,
  background = CINEMA.colors.void,
  padding = "120px 24px",
  className,
}: SectionProps) {
  return (
    <section
      id={id}
      className={className}
      style={{
        background,
        padding,
        position: "relative",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>{children}</div>
    </section>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────
interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: SectionHeaderProps) {
  return (
    <ScrollReveal>
      <div style={{ textAlign: align, marginBottom: "4rem" }}>
        {eyebrow && (
          <div
            style={{
              fontFamily: CINEMA.fonts.mono,
              fontSize: "0.65rem",
              letterSpacing: "0.4em",
              color: CINEMA.colors.gold,
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            {eyebrow}
          </div>
        )}
        <h2
          style={{
            fontFamily: CINEMA.fonts.display,
            fontSize: "clamp(2rem, 4vw, 3.5rem)",
            fontWeight: 700,
            color: CINEMA.colors.white,
            lineHeight: 1.1,
            marginBottom: subtitle ? "1rem" : 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              fontFamily: CINEMA.fonts.body,
              fontSize: "1rem",
              color: CINEMA.colors.muted,
              maxWidth: "600px",
              margin: align === "center" ? "0 auto" : "0",
              lineHeight: 1.7,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </ScrollReveal>
  );
}

// ─── TESTIMONIAL CARD ─────────────────────────────────────────
interface TestimonialCardProps {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  delay?: number;
}

export function TestimonialCard({
  quote,
  author,
  role,
  company,
  delay = 0,
}: TestimonialCardProps) {
  return (
    <ScrollReveal delay={delay}>
      <div
        style={{
          padding: "2rem",
          border: `1px solid ${CINEMA.colors.border}`,
          background: CINEMA.colors.surface,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <p
          style={{
            fontFamily: CINEMA.fonts.body,
            fontSize: "1rem",
            color: CINEMA.colors.white,
            lineHeight: 1.8,
            fontStyle: "italic",
            flex: 1,
            marginBottom: "1.5rem",
          }}
        >
          &ldquo;{quote}&rdquo;
        </p>
        <div>
          <div
            style={{
              fontFamily: CINEMA.fonts.display,
              fontSize: "1rem",
              color: CINEMA.colors.gold,
              fontWeight: 600,
            }}
          >
            {author}
          </div>
          {(role || company) && (
            <div
              style={{
                fontFamily: CINEMA.fonts.body,
                fontSize: "0.8rem",
                color: CINEMA.colors.muted,
                marginTop: "0.25rem",
              }}
            >
              {role}
              {role && company && " · "}
              {company}
            </div>
          )}
        </div>
      </div>
    </ScrollReveal>
  );
}

// ─── GLOBAL STYLES STRING (inject into layout) ────────────────
export const CINEMA_GLOBAL_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    scroll-behavior: smooth;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    background: ${CINEMA.colors.void};
    color: ${CINEMA.colors.white};
    font-family: ${CINEMA.fonts.body};
    line-height: 1.6;
    overflow-x: hidden;
  }

  ::selection {
    background: ${CINEMA.colors.goldDim};
    color: ${CINEMA.colors.gold};
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${CINEMA.colors.void}; }
  ::-webkit-scrollbar-thumb { background: ${CINEMA.colors.gold}; }

  a { color: inherit; text-decoration: none; }
  img { max-width: 100%; }
`;

"use client";

import Image from "next/image";
import { useLanguage } from "@/store/portfolio";
import { translations } from "@/lib/i18n";
import {
  getActiveProjectCount,
  getProjectsWithLiveUrl,
} from "@/lib/projects-data";
import dynamic from "next/dynamic";
import LanguageSwitcher from "./LanguageSwitcher";

// Dynamic import for canvas (client-only)
const NeuralCanvas = dynamic(() => import("./NeuralCanvas"), {
  ssr: false,
});

export default function AutopoieticHero() {
  const language = useLanguage();
  const t = translations[language].hero;

  const projectCount = getActiveProjectCount();
  const liveProjectCount = getProjectsWithLiveUrl().length;
  const aiConversations = "50K+";

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Neural Network Background */}
      <NeuralCanvas nodeCount={45} connectionDistance={140} />

      {/* Content */}
      <div className="relative z-10 container-luxury text-center">
        {/* Language Switcher - top right */}
        <div className="absolute top-6 right-6">
          <LanguageSwitcher />
        </div>

        {/* Badge */}
        <div className="animate-fade-in-up mb-8">
          <span
            className="inline-flex items-center px-4 py-2 text-sm font-medium
                       border border-[var(--mm-border)] text-gold"
          >
            <span className="w-2 h-2 bg-[var(--mm-healthy)] mr-2 animate-status-pulse" />
            {t.badge}
          </span>
        </div>

        {/* Logo */}
        <div
          className="mb-6 animate-fade-in-up flex justify-center"
          style={{ animationDelay: "100ms" }}
        >
          <Image
            src="/logo-stacked.png"
            alt="MachineMind"
            width={400}
            height={400}
            className="w-64 md:w-80 lg:w-96 h-auto"
            priority
          />
        </div>

        {/* Tagline */}
        <p
          className="text-2xl md:text-3xl lg:text-4xl text-gold font-heading mb-6 animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          {t.tagline}
        </p>

        {/* Subtitle */}
        <p
          className="text-muted text-lg md:text-xl max-w-2xl mx-auto mb-12 animate-fade-in-up"
          style={{ animationDelay: "300ms" }}
        >
          {t.subtitle}
        </p>

        {/* Stats Bar */}
        <div
          className="flex flex-wrap justify-center gap-8 md:gap-16 mb-12 animate-fade-in-up"
          style={{ animationDelay: "400ms" }}
        >
          <Stat value={projectCount.toString()} label={t.stats.projects} />
          <Stat value={liveProjectCount.toString()} label={t.stats.active} />
          <Stat value={aiConversations} label={t.stats.conversations} />
        </div>

        {/* CTA Button */}
        <div className="animate-fade-in-up" style={{ animationDelay: "500ms" }}>
          <a
            href="#portfolio"
            className="inline-flex items-center justify-center
                       min-h-[56px] px-8 py-4
                       bg-[var(--mm-gold)] text-[var(--mm-background)]
                       font-semibold text-lg
                       transition-all duration-200
                       hover:bg-[var(--mm-gold-light)]
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mm-gold)]"
          >
            {t.cta}
            <svg
              className="ml-2 w-5 h-5"
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
          </a>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in-up"
          style={{ animationDelay: "700ms" }}
        >
          <div className="w-6 h-10 border-2 border-[var(--mm-border)] flex items-start justify-center p-1">
            <div className="w-1 h-2 bg-gold animate-bounce" />
          </div>
        </div>
      </div>
    </section>
  );
}

// Stat component
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-bold text-white mb-1">
        {value}
      </div>
      <div className="text-sm text-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}

"use client";

import { useLanguage } from "@/store/portfolio";
import { translations } from "@/lib/i18n";
import {
  getActiveProjectCount,
  getProjectsWithLiveUrl,
} from "@/lib/projects-data";
import dynamic from "next/dynamic";
import LanguageSwitcher from "./LanguageSwitcher";
import { LogoStacked } from "@/components/brand";

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
        <div className="animate-fade-in-up mb-6 md:mb-8">
          <span
            className="inline-flex items-center px-3 md:px-4 py-2 text-xs md:text-sm font-medium font-mono uppercase tracking-wider
                       border border-[var(--mm-border)] text-[var(--mm-blue-core)]"
          >
            <span className="w-2 h-2 bg-[var(--mm-healthy)] mr-2 animate-status-pulse" />
            {t.badge}
          </span>
        </div>

        {/* Logo - Responsive sizing */}
        <div
          className="mb-4 md:mb-6 animate-fade-in-up flex justify-center"
          style={{ animationDelay: "100ms" }}
        >
          {/* Mobile logo */}
          <div className="md:hidden">
            <LogoStacked size={220} />
          </div>
          {/* Desktop logo */}
          <div className="hidden md:block">
            <LogoStacked size={320} />
          </div>
        </div>

        {/* Tagline - Cinema Engine text animation */}
        <p
          className="text-xl md:text-2xl lg:text-4xl text-[var(--mm-blue-core)] font-heading mb-4 md:mb-6 animate-fade-in-up px-4"
          style={{ animationDelay: "200ms" }}
          data-text="rotate-in"
        >
          {t.tagline}
        </p>

        {/* Subtitle - Cinema Engine scroll-fade effect */}
        <p
          className="text-muted text-base md:text-lg lg:text-xl max-w-2xl mx-auto mb-8 md:mb-12 animate-fade-in-up px-4"
          style={{ animationDelay: "300ms" }}
          data-text="scroll-fade"
        >
          {t.subtitle}
        </p>

        {/* Stats Bar */}
        <div
          className="flex flex-wrap justify-center gap-4 sm:gap-8 md:gap-16 mb-8 md:mb-12 animate-fade-in-up"
          style={{ animationDelay: "400ms" }}
        >
          <Stat value={projectCount.toString()} label={t.stats.projects} />
          <Stat value={liveProjectCount.toString()} label={t.stats.active} />
          <Stat value={aiConversations} label={t.stats.conversations} />
        </div>

        {/* CTA Button - Cinema Engine magnetic effect */}
        <div className="animate-fade-in-up" style={{ animationDelay: "500ms" }}>
          <a
            href="#portfolio"
            className="inline-flex items-center justify-center
                       min-h-[56px] px-8 py-4
                       bg-[var(--mm-blue-core)] text-[var(--mm-background)]
                       font-semibold text-lg
                       transition-all duration-200
                       hover:bg-[var(--mm-blue-bright)]
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mm-blue-core)]"
            data-magnetic="0.3"
          >
            <span data-magnetic-inner className="flex items-center">
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
            </span>
          </a>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in-up"
          style={{ animationDelay: "700ms" }}
        >
          <div className="w-6 h-10 border-2 border-[var(--mm-border)] flex items-start justify-center p-1">
            <div className="w-1 h-2 bg-[var(--mm-blue-core)] animate-bounce" />
          </div>
        </div>
      </div>
    </section>
  );
}

// Stat component
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center min-w-[80px]">
      <div className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-1 font-heading">
        {value}
      </div>
      <div className="text-xs sm:text-sm text-muted uppercase tracking-wider font-mono">
        {label}
      </div>
    </div>
  );
}

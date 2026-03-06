"use client";

import { useLanguage } from "@/store/portfolio";
import { translations } from "@/lib/i18n";
import { LogoEmblemSimple } from "@/components/brand";
import { BOOKING_URL } from "@/lib/constants";

export default function Footer() {
  const language = useLanguage();
  const t = translations[language].footer;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--mm-border)] py-8">
      <div className="container-luxury">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <LogoEmblemSimple size={32} />
            <div className="font-heading text-xl font-bold">
              <span className="text-[#00B4FF]">Machine</span>
              <span className="text-white">Mind</span>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-muted text-sm font-mono">
            {t.copyright.replace("{year}", currentYear.toString())}
          </div>

          {/* Links */}
          <div className="flex gap-6 text-sm">
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-[var(--mm-blue-core)] transition-colors"
            >
              {language === "es" ? "Agendar Llamada" : "Book a Call"}
            </a>
            <a
              href="#contact"
              className="text-muted hover:text-white transition-colors"
            >
              {t.contact}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

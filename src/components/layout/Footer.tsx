"use client";

import { useLanguage } from "@/store/portfolio";
import { translations } from "@/lib/i18n";

export default function Footer() {
  const language = useLanguage();
  const t = translations[language].footer;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--mm-border)] py-8">
      <div className="container-luxury">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="font-heading text-xl font-bold">
            <span className="text-white">Machine</span>
            <span className="text-gold">Mind</span>
          </div>

          {/* Copyright */}
          <div className="text-muted text-sm">
            {t.copyright.replace("{year}", currentYear.toString())}
          </div>

          {/* Links */}
          <div className="flex gap-6 text-sm">
            <a
              href="#"
              className="text-muted hover:text-white transition-colors"
            >
              {t.privacy}
            </a>
            <a
              href="#"
              className="text-muted hover:text-white transition-colors"
            >
              {t.terms}
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

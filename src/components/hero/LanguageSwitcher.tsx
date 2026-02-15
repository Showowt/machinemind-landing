"use client";

import { useLanguage, useSetLanguage } from "@/store/portfolio";
import type { Language } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const language = useLanguage();
  const setLanguage = useSetLanguage();

  const languages: { code: Language; label: string }[] = [
    { code: "es", label: "ES" },
    { code: "en", label: "EN" },
  ];

  return (
    <div className="flex border border-[var(--mm-border)]">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`
            px-3 py-2 text-sm font-medium transition-all duration-200
            min-h-[44px] min-w-[44px]
            ${
              language === lang.code
                ? "bg-[var(--mm-gold)] text-[var(--mm-background)]"
                : "bg-transparent text-[var(--mm-text-muted)] hover:text-[var(--mm-text)] hover:bg-[rgba(255,255,255,0.05)]"
            }
          `}
          aria-label={`Switch to ${lang.label}`}
          aria-pressed={language === lang.code}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}

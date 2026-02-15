"use client";

import {
  useLanguage,
  useSelectedCategory,
  useSetSelectedCategory,
} from "@/store/portfolio";
import { categoryLabels, type ProjectCategory } from "@/lib/projects-data";
import { translations } from "@/lib/i18n";

const categories: (ProjectCategory | "all")[] = [
  "all",
  "flagship",
  "demo",
  "automation",
  "enterprise",
];

export default function CategoryFilter() {
  const language = useLanguage();
  const selectedCategory = useSelectedCategory();
  const setSelectedCategory = useSetSelectedCategory();
  const t = translations[language].portfolio.filter;

  const getLabel = (category: ProjectCategory | "all"): string => {
    if (category === "all") return t.all;
    return categoryLabels[category][language];
  };

  return (
    <div className="flex flex-wrap justify-center gap-2 mb-12">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => setSelectedCategory(category)}
          className={`
            px-5 py-3 min-h-[48px]
            text-sm font-medium
            border transition-all duration-200
            ${
              selectedCategory === category
                ? "bg-[var(--mm-gold)] text-[var(--mm-background)] border-[var(--mm-gold)]"
                : "bg-transparent text-[var(--mm-text-muted)] border-[var(--mm-border)] hover:border-[var(--mm-gold)] hover:text-[var(--mm-text)]"
            }
          `}
          aria-pressed={selectedCategory === category}
        >
          {getLabel(category)}
        </button>
      ))}
    </div>
  );
}

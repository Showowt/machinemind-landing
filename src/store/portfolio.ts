"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/lib/i18n";
import type { ProjectCategory } from "@/lib/projects-data";

interface PortfolioState {
  // Language
  language: Language;
  setLanguage: (lang: Language) => void;

  // Filter
  selectedCategory: ProjectCategory | "all";
  setSelectedCategory: (category: ProjectCategory | "all") => void;

  // UI State
  isFilterOpen: boolean;
  setIsFilterOpen: (open: boolean) => void;
}

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set) => ({
      // Language - default Spanish
      language: "es",
      setLanguage: (language) => set({ language }),

      // Filter - default all
      selectedCategory: "all",
      setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

      // UI State
      isFilterOpen: false,
      setIsFilterOpen: (isFilterOpen) => set({ isFilterOpen }),
    }),
    {
      name: "machinemind-portfolio",
      partialize: (state) => ({
        language: state.language,
      }),
    },
  ),
);

// Selector hooks for better performance
export const useLanguage = () => usePortfolioStore((s) => s.language);
export const useSetLanguage = () => usePortfolioStore((s) => s.setLanguage);
export const useSelectedCategory = () =>
  usePortfolioStore((s) => s.selectedCategory);
export const useSetSelectedCategory = () =>
  usePortfolioStore((s) => s.setSelectedCategory);

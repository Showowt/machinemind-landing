"use client";

import Link from "next/link";
import { useLanguage } from "@/store/portfolio";
import LanguageSwitcher from "@/components/hero/LanguageSwitcher";
import { LogoHorizontal } from "@/components/brand";
import MobileMenu from "./MobileMenu";
import { BOOKING_URL } from "@/lib/constants";

export default function Header() {
  const language = useLanguage();

  const navItems = [
    { href: "#portfolio", label: language === "es" ? "Proyectos" : "Projects" },
    {
      href: "#capabilities",
      label: language === "es" ? "Servicios" : "Services",
    },
    { href: "#contact", label: language === "es" ? "Contacto" : "Contact" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--mm-background)]/90 border-b border-[var(--mm-border)]">
      <div className="container-luxury flex items-center justify-between h-16 md:h-20">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <LogoHorizontal size={32} className="md:hidden" />
          <LogoHorizontal size={40} className="hidden md:flex" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-4">
          <LanguageSwitcher />

          {/* Desktop CTA */}
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center justify-center min-h-[44px] px-6 bg-[var(--mm-blue-core)] text-[var(--mm-background)] font-semibold text-sm transition-all duration-200 hover:bg-[var(--mm-blue-bright)]"
          >
            {language === "es" ? "Agendar Llamada" : "Book a Call"}
          </a>

          {/* Mobile Menu */}
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/store/portfolio";
import { LogoEmblemSimple } from "@/components/brand";
import { BOOKING_URL } from "@/lib/constants";

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const language = useLanguage();

  const navItems = [
    { href: "#portfolio", label: language === "es" ? "Proyectos" : "Projects" },
    {
      href: "#capabilities",
      label: language === "es" ? "Servicios" : "Services",
    },
    { href: "#contact", label: language === "es" ? "Contacto" : "Contact" },
  ];

  const handleNavClick = () => {
    setIsOpen(false);
  };

  return (
    <div className="md:hidden">
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative z-50 w-12 h-12 flex items-center justify-center"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        <div className="w-6 h-5 flex flex-col justify-between">
          <motion.span
            className="block h-0.5 w-full bg-white origin-center"
            animate={isOpen ? { rotate: 45, y: 9 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3 }}
          />
          <motion.span
            className="block h-0.5 w-full bg-white"
            animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
          <motion.span
            className="block h-0.5 w-full bg-white origin-center"
            animate={isOpen ? { rotate: -45, y: -9 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </button>

      {/* Overlay Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-[var(--mm-void)]/95 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Menu Content */}
            <motion.nav
              className="fixed inset-0 z-40 flex flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Logo */}
              <motion.div
                className="mb-12"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <LogoEmblemSimple size={64} />
              </motion.div>

              {/* Nav Links */}
              <ul className="flex flex-col items-center gap-8">
                {navItems.map((item, index) => (
                  <motion.li
                    key={item.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.1 }}
                  >
                    <a
                      href={item.href}
                      onClick={handleNavClick}
                      className="text-2xl font-heading font-semibold text-white hover:text-[var(--mm-blue-core)] transition-colors"
                    >
                      {item.label}
                    </a>
                  </motion.li>
                ))}
              </ul>

              {/* CTA Button */}
              <motion.div
                className="mt-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
              >
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleNavClick}
                  className="inline-flex items-center justify-center min-h-[56px] px-8 bg-[var(--mm-blue-core)] text-[var(--mm-background)] font-semibold text-lg transition-all duration-200 hover:bg-[var(--mm-blue-bright)]"
                >
                  {language === "es" ? "Agendar Llamada" : "Book a Call"}
                </a>
              </motion.div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

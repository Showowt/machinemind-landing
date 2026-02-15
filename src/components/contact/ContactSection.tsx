"use client";

import { useLanguage } from "@/store/portfolio";
import { translations } from "@/lib/i18n";
import ContactForm from "./ContactForm";

export default function ContactSection() {
  const language = useLanguage();
  const t = translations[language].contact;

  return (
    <section id="contact" className="section-padding">
      <div className="container-luxury">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4">
              {t.title}
            </h2>
            <p className="text-muted text-lg">{t.subtitle}</p>
            <div className="gold-line w-24 mx-auto mt-6" />
          </div>

          {/* Contact Form */}
          <div className="border border-[var(--mm-border)] bg-[rgba(15,15,26,0.6)] p-8">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}

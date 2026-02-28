"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/store/portfolio";
import { testimonials } from "@/lib/testimonials-data";
import { RevealOnScroll } from "@/components/animation";

export default function TestimonialsCarousel() {
  const language = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const title =
    language === "es"
      ? "Lo que dicen nuestros clientes"
      : "What our clients say";
  const subtitle =
    language === "es"
      ? "Historias reales de transformación digital"
      : "Real stories of digital transformation";

  // Auto-advance
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const current = testimonials[activeIndex];
  const quote = language === "es" ? current.quoteEs : current.quoteEn;
  const metricLabel = current.metric
    ? language === "es"
      ? current.metric.labelEs
      : current.metric.labelEn
    : "";

  return (
    <section className="section-padding">
      <div className="container-luxury">
        {/* Header */}
        <RevealOnScroll direction="up" className="text-center mb-16">
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4">
            {title}
          </h2>
          <p className="text-muted text-lg">{subtitle}</p>
          <div className="gold-line w-24 mx-auto mt-6" />
        </RevealOnScroll>

        {/* Carousel */}
        <div
          className="relative max-w-4xl mx-auto"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              {/* Quote */}
              <blockquote className="relative">
                {/* Quote mark */}
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-6xl text-gold opacity-30 font-heading">
                  &ldquo;
                </span>

                <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white leading-relaxed mb-8 px-8">
                  {quote.split(current.highlightPhrase).map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="text-gold font-semibold">
                          {current.highlightPhrase}
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              </blockquote>

              {/* Client info */}
              <div className="flex flex-col items-center gap-4">
                {/* Avatar placeholder */}
                <div className="w-16 h-16 border border-[var(--mm-gold)] flex items-center justify-center">
                  <span className="text-gold text-xl font-bold">
                    {current.clientName.charAt(0)}
                  </span>
                </div>

                <div>
                  <div className="font-semibold text-white">
                    {current.clientName}
                  </div>
                  <div className="text-muted text-sm">
                    {current.clientTitle}, {current.company}
                  </div>
                </div>

                {/* Metric */}
                {current.metric && (
                  <div className="mt-4 px-6 py-3 border border-[var(--mm-blue-core)] bg-[rgba(0,180,255,0.1)]">
                    <span className="text-2xl font-bold text-gold">
                      {current.metric.value}
                    </span>
                    <span className="text-muted text-sm ml-2">
                      {metricLabel}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation dots */}
          <div className="flex justify-center gap-3 mt-12">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`w-3 h-3 transition-all duration-300 ${
                  i === activeIndex
                    ? "bg-[var(--mm-gold)] scale-125"
                    : "bg-[var(--mm-border)] hover:bg-[var(--mm-gold)] hover:opacity-50"
                }`}
                aria-label={`Go to testimonial ${i + 1}`}
              />
            ))}
          </div>

          {/* Arrow navigation */}
          <button
            onClick={() =>
              setActiveIndex(
                (prev) =>
                  (prev - 1 + testimonials.length) % testimonials.length,
              )
            }
            className="absolute left-0 top-1/2 -translate-y-1/2 translate-x-0 sm:-translate-x-4 md:-translate-x-12
                       w-12 h-12 border border-[var(--mm-border)]
                       flex items-center justify-center
                       text-muted hover:text-gold hover:border-[var(--mm-gold)]
                       transition-all duration-200
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mm-blue-core)]"
            aria-label="Previous testimonial"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() =>
              setActiveIndex((prev) => (prev + 1) % testimonials.length)
            }
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-0 sm:translate-x-4 md:translate-x-12
                       w-12 h-12 border border-[var(--mm-border)]
                       flex items-center justify-center
                       text-muted hover:text-gold hover:border-[var(--mm-gold)]
                       transition-all duration-200
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mm-blue-core)]"
            aria-label="Next testimonial"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

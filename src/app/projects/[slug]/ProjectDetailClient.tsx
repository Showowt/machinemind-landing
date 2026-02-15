"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLanguage } from "@/store/portfolio";
import { translations } from "@/lib/i18n";
import type { Project } from "@/lib/projects-data";
import { projects } from "@/lib/projects-data";
import { Badge, Button } from "@/components/ui";
import { RevealOnScroll, CountUp } from "@/components/animation";
import { Footer } from "@/components/layout";
import { WhatsAppCTA } from "@/components/contact";

interface Props {
  project: Project;
}

export default function ProjectDetailClient({ project }: Props) {
  const language = useLanguage();
  const t = translations[language].portfolio;

  const name = language === "es" ? project.nameEs : project.nameEn;
  const tagline = language === "es" ? project.taglineEs : project.taglineEn;
  const description =
    language === "es" ? project.descriptionEs : project.descriptionEn;

  // Get related projects (same category, excluding current)
  const relatedProjects = projects
    .filter(
      (p) =>
        p.category === project.category &&
        p.slug !== project.slug &&
        p.isActive,
    )
    .slice(0, 3);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section
        className="relative min-h-[60vh] flex items-end pb-16"
        style={{
          background: `linear-gradient(to bottom, ${project.colorAccent}15, var(--mm-background))`,
        }}
      >
        {/* Back button */}
        <Link
          href="/#portfolio"
          className="absolute top-8 left-8 flex items-center gap-2 text-muted hover:text-white transition-colors"
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
          <span>{language === "es" ? "Volver" : "Back"}</span>
        </Link>

        <div className="container-luxury">
          <RevealOnScroll direction="up">
            {/* Category badge */}
            <Badge variant="gold" className="mb-6">
              {project.category.toUpperCase()}
            </Badge>

            {/* Title */}
            <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
              {name}
            </h1>

            {/* Tagline */}
            <p className="text-xl md:text-2xl text-gold mb-8 max-w-2xl">
              {tagline}
            </p>

            {/* Live badge & CTA */}
            <div className="flex flex-wrap items-center gap-4">
              {project.liveUrl && (
                <>
                  <span className="flex items-center gap-2 text-[var(--mm-healthy)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--mm-healthy)] animate-pulse" />
                    LIVE
                  </span>
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center
                               min-h-[56px] px-8
                               bg-[var(--mm-gold)] text-[var(--mm-background)]
                               font-semibold text-lg
                               transition-all duration-200
                               hover:bg-[var(--mm-gold-light)]"
                  >
                    {t.liveDemo}
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
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </>
              )}
            </div>
          </RevealOnScroll>
        </div>

        {/* Color accent bar */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: project.colorAccent }}
        />
      </section>

      {/* Description */}
      {description && (
        <section className="section-padding">
          <div className="container-luxury">
            <div className="max-w-3xl">
              <RevealOnScroll direction="up">
                <h2 className="font-heading text-3xl font-bold text-white mb-6">
                  {language === "es" ? "El Proyecto" : "The Project"}
                </h2>
                <p className="text-muted text-lg leading-relaxed">
                  {description}
                </p>
              </RevealOnScroll>
            </div>
          </div>
        </section>
      )}

      {/* Tech Stack */}
      <section className="section-padding bg-[rgba(0,0,0,0.2)]">
        <div className="container-luxury">
          <RevealOnScroll direction="up">
            <h2 className="font-heading text-3xl font-bold text-white mb-8">
              {t.techStack}
            </h2>
            <div className="flex flex-wrap gap-4">
              {project.techStack.map((tech, index) => (
                <motion.div
                  key={tech}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="px-6 py-4 border border-[var(--mm-border)]
                             bg-[rgba(15,15,26,0.6)]
                             text-white font-medium"
                >
                  {tech}
                </motion.div>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* Metrics (placeholder) */}
      <section className="section-padding">
        <div className="container-luxury">
          <RevealOnScroll direction="up">
            <h2 className="font-heading text-3xl font-bold text-white mb-12 text-center">
              {language === "es" ? "Resultados" : "Results"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
              <div>
                <div className="text-4xl font-bold text-gold mb-2">
                  <CountUp end={47} suffix="%" />
                </div>
                <div className="text-muted text-sm">
                  {language === "es" ? "Más Reservas" : "More Bookings"}
                </div>
              </div>
              <div>
                <div className="text-4xl font-bold text-gold mb-2">
                  <CountUp end={30} suffix="s" />
                </div>
                <div className="text-muted text-sm">
                  {language === "es" ? "Tiempo Respuesta" : "Response Time"}
                </div>
              </div>
              <div>
                <div className="text-4xl font-bold text-gold mb-2">
                  <CountUp end={99} suffix="%" decimals={1} />
                </div>
                <div className="text-muted text-sm">Uptime</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-gold mb-2">
                  <CountUp end={6} />
                </div>
                <div className="text-muted text-sm">
                  {language === "es" ? "Semanas" : "Weeks"}
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* Related Projects */}
      {relatedProjects.length > 0 && (
        <section className="section-padding bg-[rgba(0,0,0,0.2)]">
          <div className="container-luxury">
            <RevealOnScroll direction="up">
              <h2 className="font-heading text-3xl font-bold text-white mb-12 text-center">
                {language === "es"
                  ? "Proyectos Relacionados"
                  : "Related Projects"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedProjects.map((related, index) => (
                  <Link
                    key={related.slug}
                    href={`/projects/${related.slug}`}
                    className="group"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-6 border border-[var(--mm-border)]
                                 bg-[rgba(15,15,26,0.6)]
                                 transition-all duration-300
                                 hover:border-[var(--mm-border-hover)]
                                 hover:-translate-y-1"
                    >
                      <div
                        className="h-1 w-full mb-4"
                        style={{ backgroundColor: related.colorAccent }}
                      />
                      <h3 className="font-heading text-lg font-semibold text-white mb-2 group-hover:text-gold transition-colors">
                        {language === "es" ? related.nameEs : related.nameEn}
                      </h3>
                      <p className="text-muted text-sm">
                        {language === "es"
                          ? related.taglineEs
                          : related.taglineEn}
                      </p>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </RevealOnScroll>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="section-padding">
        <div className="container-luxury text-center">
          <RevealOnScroll direction="up">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-6">
              {language === "es"
                ? "¿Listo para transformar tu negocio?"
                : "Ready to transform your business?"}
            </h2>
            <p className="text-muted text-lg mb-8 max-w-2xl mx-auto">
              {language === "es"
                ? "Agenda una consulta gratuita y descubre cómo podemos ayudarte."
                : "Schedule a free consultation and discover how we can help you."}
            </p>
            <Link href="/#contact">
              <Button variant="gold" size="lg">
                {language === "es" ? "Contactar" : "Get in Touch"}
              </Button>
            </Link>
          </RevealOnScroll>
        </div>
      </section>

      <Footer />
      <WhatsAppCTA />
    </main>
  );
}

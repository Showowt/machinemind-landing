"use client";

import { useLanguage } from "@/store/portfolio";
import { translations } from "@/lib/i18n";
import type { Project } from "@/lib/projects-data";
import { Badge } from "@/components/ui";

interface FlagshipShowcaseProps {
  projects: Project[];
}

export default function FlagshipShowcase({ projects }: FlagshipShowcaseProps) {
  const language = useLanguage();
  const t = translations[language].portfolio;

  return (
    <div className="mb-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {projects.map((project, index) => {
          const name = language === "es" ? project.nameEs : project.nameEn;
          const tagline =
            language === "es" ? project.taglineEs : project.taglineEn;
          const description =
            language === "es" ? project.descriptionEs : project.descriptionEn;

          return (
            <article
              key={project.slug}
              className="group relative border border-[var(--mm-gold)] border-opacity-30
                         bg-[rgba(15,15,26,0.8)]
                         transition-all duration-500 hover:border-opacity-60"
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              {/* Featured badge */}
              <div className="absolute -top-3 left-6">
                <Badge variant="gold">
                  {language === "es" ? "INSIGNIA" : "FLAGSHIP"}
                </Badge>
              </div>

              {/* Color accent bar */}
              <div
                className="h-2 w-full"
                style={{ backgroundColor: project.colorAccent }}
              />

              <div className="p-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-heading text-2xl font-bold text-white">
                    {name}
                  </h3>
                  {project.liveUrl && (
                    <span className="flex items-center gap-2 text-xs text-[var(--mm-healthy)]">
                      <span className="w-2 h-2 rounded-full bg-[var(--mm-healthy)] animate-status-pulse" />
                      LIVE
                    </span>
                  )}
                </div>

                {/* Tagline */}
                <p className="text-gold text-lg mb-4">{tagline}</p>

                {/* Description */}
                {description && (
                  <p className="text-muted text-sm mb-6 line-clamp-2">
                    {description}
                  </p>
                )}

                {/* Tech Stack */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {project.techStack.map((tech) => (
                    <Badge key={tech} variant="default">
                      {tech}
                    </Badge>
                  ))}
                </div>

                {/* Action */}
                {project.liveUrl ? (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center
                               min-h-[56px] px-6
                               text-base font-semibold
                               bg-[var(--mm-gold)] text-[var(--mm-background)]
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
                ) : (
                  <span
                    className="w-full inline-flex items-center justify-center
                               min-h-[56px] px-6
                               text-base font-semibold
                               border border-[var(--mm-border)] text-[var(--mm-text-muted)]"
                  >
                    <svg
                      className="mr-2 w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    {t.classified}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

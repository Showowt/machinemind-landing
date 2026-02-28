"use client";

import { useLanguage } from "@/store/portfolio";
import { translations } from "@/lib/i18n";
import type { Project } from "@/lib/projects-data";
import { Badge } from "@/components/ui";

interface ProjectCardProps {
  project: Project;
  index: number;
}

export default function ProjectCard({ project, index }: ProjectCardProps) {
  const language = useLanguage();
  const t = translations[language].portfolio;

  const name = language === "es" ? project.nameEs : project.nameEn;
  const tagline = language === "es" ? project.taglineEs : project.taglineEn;

  return (
    <article
      className="group border border-[var(--mm-border)] bg-[rgba(15,15,26,0.6)]
                 transition-all duration-300 hover:border-[var(--mm-border-hover)]
                 hover:-translate-y-1"
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Color accent bar */}
      <div
        className="h-1 w-full transition-all duration-300 group-hover:h-2"
        style={{ backgroundColor: project.colorAccent }}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-heading text-xl font-semibold text-white mb-1">
              {name}
            </h3>
            <p className="text-muted text-sm">{tagline}</p>
          </div>

          {/* Status indicator */}
          {project.liveUrl && (
            <span
              className="w-2 h-2 bg-[var(--mm-healthy)] animate-status-pulse"
              title="Live"
            />
          )}
        </div>

        {/* Tech Stack */}
        <div className="flex flex-wrap gap-2 mb-6">
          {project.techStack.slice(0, 4).map((tech) => (
            <Badge key={tech} variant="default">
              {tech}
            </Badge>
          ))}
          {project.techStack.length > 4 && (
            <Badge variant="default">+{project.techStack.length - 4}</Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {project.liveUrl ? (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center
                         min-h-[48px] px-4
                         text-sm font-medium
                         bg-[var(--mm-gold)] text-[var(--mm-background)]
                         transition-all duration-200
                         hover:bg-[var(--mm-gold-light)]"
            >
              {t.liveDemo}
              <svg
                className="ml-2 w-4 h-4"
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
              className="flex-1 inline-flex items-center justify-center
                         min-h-[48px] px-4
                         text-sm font-medium
                         border border-[var(--mm-border)] text-[var(--mm-text-muted)]"
            >
              <svg
                className="mr-2 w-4 h-4"
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
      </div>
    </article>
  );
}

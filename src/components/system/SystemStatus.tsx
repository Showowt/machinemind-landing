"use client";

import { useLanguage } from "@/store/portfolio";
import { translations } from "@/lib/i18n";
import { getProjectsWithLiveUrl, type Project } from "@/lib/projects-data";
import PulseIndicator from "./PulseIndicator";

// Simulated status data (in production, this would come from Vercel API)
interface ProjectStatus {
  slug: string;
  status: "healthy" | "degraded" | "down";
  responseTime: number;
}

// Mock status - all healthy for demo
function getProjectStatuses(projects: Project[]): ProjectStatus[] {
  return projects.map((p) => ({
    slug: p.slug,
    status: "healthy" as const,
    responseTime: Math.floor(Math.random() * 150) + 50, // 50-200ms
  }));
}

export default function SystemStatus() {
  const language = useLanguage();
  const t = translations[language].status;

  const liveProjects = getProjectsWithLiveUrl();
  const statuses = getProjectStatuses(liveProjects);

  const healthyCount = statuses.filter((s) => s.status === "healthy").length;
  const totalCount = statuses.length;
  const allHealthy = healthyCount === totalCount;

  return (
    <section className="section-padding bg-[rgba(0,0,0,0.3)]">
      <div className="container-luxury">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4">
            {t.title}
          </h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">{t.subtitle}</p>
          <div className="gold-line w-24 mx-auto mt-6" />
        </div>

        {/* Overall Status Banner */}
        <div
          className={`
            flex items-center justify-center gap-4 p-6 mb-12
            border ${allHealthy ? "border-[rgba(34,197,94,0.3)]" : "border-[rgba(234,179,8,0.3)]"}
          `}
        >
          <PulseIndicator
            status={allHealthy ? "healthy" : "degraded"}
            size="lg"
          />
          <span className="text-xl font-semibold text-white">
            {allHealthy ? t.operational : t.partial}
          </span>
          <span className="text-muted text-sm">
            {healthyCount}/{totalCount}{" "}
            {language === "es" ? "sistemas" : "systems"}
          </span>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {liveProjects.map((project) => {
            const status = statuses.find((s) => s.slug === project.slug);
            const name = language === "es" ? project.nameEs : project.nameEn;

            return (
              <a
                key={project.slug}
                href={project.liveUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-4 border border-[var(--mm-border)]
                           bg-[rgba(15,15,26,0.6)]
                           transition-all duration-200
                           hover:border-[var(--mm-border-hover)]"
              >
                <div className="flex items-center justify-between mb-2">
                  <PulseIndicator
                    status={status?.status || "unknown"}
                    size="sm"
                  />
                  <span className="text-xs text-muted">
                    {status?.responseTime}ms
                  </span>
                </div>
                <div className="text-sm font-medium text-white truncate group-hover:text-gold transition-colors">
                  {name}
                </div>
              </a>
            );
          })}
        </div>

        {/* Last checked */}
        <div className="text-center mt-8">
          <span className="text-xs text-muted">
            {t.lastChecked}: {new Date().toLocaleTimeString(language)}
          </span>
        </div>
      </div>
    </section>
  );
}

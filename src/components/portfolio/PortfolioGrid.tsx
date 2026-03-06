"use client";

import { useLanguage, useSelectedCategory } from "@/store/portfolio";
import { translations } from "@/lib/i18n";
import { projects, type ProjectCategory } from "@/lib/projects-data";
import CategoryFilter from "./CategoryFilter";
import ProjectCard from "./ProjectCard";
import FlagshipShowcase from "./FlagshipShowcase";

export default function PortfolioGrid() {
  const language = useLanguage();
  const selectedCategory = useSelectedCategory();
  const t = translations[language].portfolio;

  // Filter projects
  const filteredProjects =
    selectedCategory === "all"
      ? projects.filter((p) => p.isActive)
      : projects.filter((p) => p.category === selectedCategory && p.isActive);

  // Get flagship projects for showcase (only when showing all or flagship)
  const showFlagship =
    selectedCategory === "all" || selectedCategory === "flagship";
  const flagshipProjects = projects.filter((p) => p.isFeatured && p.isActive);

  // Non-flagship projects for the grid
  const gridProjects = showFlagship
    ? filteredProjects.filter((p) => !p.isFeatured)
    : filteredProjects;

  return (
    <section id="portfolio" className="py-24 md:py-32 relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(var(--mm-gold) 1px, transparent 1px),
                           linear-gradient(90deg, var(--mm-gold) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-8 relative">
        {/* Section Header - Cinema Engine Style */}
        <div className="mb-20">
          {/* Top accent line */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-px bg-gradient-to-r from-[var(--mm-gold)] to-transparent" />
            <span className="text-[10px] tracking-[0.3em] text-[var(--mm-gold)] uppercase font-medium">
              {language === "es" ? "Portafolio" : "Portfolio"}
            </span>
          </div>

          {/* Main title with split styling */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h2
                className="font-['Clash_Display',sans-serif] text-4xl md:text-5xl lg:text-6xl font-semibold text-white leading-[1.1] mb-4"
                data-text="slide-up"
              >
                {language === "es" ? (
                  <>
                    <span className="text-[var(--mm-gold)]">Ecosistema</span>
                    <br className="hidden md:block" />
                    <span className="md:ml-0"> de Proyectos</span>
                  </>
                ) : (
                  <>
                    <span className="text-[var(--mm-gold)]">Project</span>
                    <br className="hidden md:block" />
                    <span className="md:ml-0"> Ecosystem</span>
                  </>
                )}
              </h2>
              <p className="text-white/40 text-sm md:text-base max-w-md font-['Satoshi',sans-serif]">
                {language === "es"
                  ? "Cada proyecto es un nodo vivo en nuestra red autopoiética"
                  : "Each project is a living node in our autopoietic network"}
              </p>
            </div>

            {/* Stats pill */}
            <div className="flex items-center gap-6 pb-2">
              <div className="text-right">
                <div className="text-3xl md:text-4xl font-['Clash_Display',sans-serif] font-semibold text-white">
                  {projects.filter((p) => p.isActive).length}
                </div>
                <div className="text-[10px] tracking-[0.2em] text-white/30 uppercase">
                  {language === "es" ? "Activos" : "Active"}
                </div>
              </div>
              <div className="w-px h-12 bg-gradient-to-b from-transparent via-[var(--mm-gold)]/30 to-transparent" />
              <div className="text-right">
                <div className="text-3xl md:text-4xl font-['Clash_Display',sans-serif] font-semibold text-[var(--mm-gold)]">
                  {projects.filter((p) => p.isFeatured).length}
                </div>
                <div className="text-[10px] tracking-[0.2em] text-white/30 uppercase">
                  {language === "es" ? "Flagship" : "Flagship"}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom line */}
          <div className="mt-8 h-px bg-gradient-to-r from-[var(--mm-gold)]/20 via-[var(--mm-gold)]/5 to-transparent" />
        </div>

        {/* Category Filter */}
        <CategoryFilter />

        {/* Flagship Showcase */}
        {showFlagship && flagshipProjects.length > 0 && (
          <FlagshipShowcase projects={flagshipProjects} />
        )}

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
          {gridProjects.map((project, index) => (
            <ProjectCard key={project.slug} project={project} index={index} />
          ))}
        </div>

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-px bg-[var(--mm-gold)]/20 mx-auto mb-6" />
            <p className="text-white/30 text-sm tracking-wide">
              {language === "es"
                ? "No hay proyectos en esta categoría"
                : "No projects in this category"}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

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
    <section id="portfolio" className="section-padding">
      <div className="container-luxury">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4">
            {t.title}
          </h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">{t.subtitle}</p>
          {/* Gold line accent */}
          <div className="gold-line w-24 mx-auto mt-6" />
        </div>

        {/* Category Filter */}
        <CategoryFilter />

        {/* Flagship Showcase */}
        {showFlagship && flagshipProjects.length > 0 && (
          <FlagshipShowcase projects={flagshipProjects} />
        )}

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gridProjects.map((project, index) => (
            <ProjectCard key={project.slug} project={project} index={index} />
          ))}
        </div>

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted text-lg">
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

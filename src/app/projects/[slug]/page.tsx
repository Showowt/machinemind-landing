import { notFound } from "next/navigation";
import { projects, getProjectBySlug } from "@/lib/projects-data";
import ProjectDetailClient from "./ProjectDetailClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return projects
    .filter((p) => p.isActive)
    .map((project) => ({
      slug: project.slug,
    }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    return {
      title: "Project Not Found | MachineMind",
    };
  }

  return {
    title: `${project.nameEn} | MachineMind Portfolio`,
    description: project.taglineEn,
    openGraph: {
      title: project.nameEn,
      description: project.taglineEn,
      type: "article",
    },
  };
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  return <ProjectDetailClient project={project} />;
}

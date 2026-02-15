import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-heading text-4xl font-bold text-white mb-4">
          Project Not Found
        </h1>
        <p className="text-muted mb-8">
          The project you&apos;re looking for doesn&apos;t exist or has been
          removed.
        </p>
        <Link
          href="/#portfolio"
          className="inline-flex items-center justify-center
                     min-h-[56px] px-8
                     bg-[var(--mm-gold)] text-[var(--mm-background)]
                     font-semibold
                     transition-all duration-200
                     hover:bg-[var(--mm-gold-light)]"
        >
          Back to Portfolio
        </Link>
      </div>
    </div>
  );
}

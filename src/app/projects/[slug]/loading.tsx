export default function ProjectLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[var(--mm-gold)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted">Loading project...</p>
      </div>
    </div>
  );
}

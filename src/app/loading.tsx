export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {/* Logo */}
        <div className="font-heading text-4xl font-bold mb-6 animate-pulse-glow">
          <span className="text-white">Machine</span>
          <span className="text-gold">Mind</span>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-1 bg-[var(--mm-border)] mx-auto overflow-hidden">
          <div
            className="h-full bg-[var(--mm-gold)] animate-pulse"
            style={{ width: "60%" }}
          />
        </div>

        {/* Loading text */}
        <p className="text-muted text-sm mt-4">Inicializando sistemas...</p>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center">
        {/* Logo */}
        <div className="font-heading text-4xl font-bold mb-6">
          <span className="text-[#00B4FF]">Machine</span>
          <span className="text-white">Mind</span>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-1 bg-[rgba(0,180,255,0.08)] mx-auto overflow-hidden">
          <div
            className="h-full bg-[#00B4FF] animate-pulse"
            style={{ width: "60%" }}
          />
        </div>

        {/* Loading text */}
        <p className="text-[#8892a4] text-sm mt-4 font-mono tracking-wider uppercase">
          Self-Sustaining Intelligence
        </p>
      </div>
    </div>
  );
}

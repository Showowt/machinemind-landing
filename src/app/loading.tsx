export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#06060a]">
      <div className="text-center">
        {/* Logo */}
        <div
          className="text-4xl font-bold mb-6"
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          <span className="text-[#c9a96e]">Machine</span>
          <span className="text-white">Mind</span>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-[1px] bg-[rgba(201,169,110,0.1)] mx-auto overflow-hidden">
          <div
            className="h-full bg-[#c9a96e] animate-pulse"
            style={{ width: "60%" }}
          />
        </div>

        {/* Loading text */}
        <p
          className="text-[#8892a4] text-[10px] mt-4 tracking-[0.35em] uppercase"
          style={{ fontFamily: "'Satoshi', sans-serif" }}
        >
          AUTOPOIETIC SYSTEMS
        </p>
      </div>
    </div>
  );
}

import { ImageResponse } from "next/og";
import { getProductBySlug } from "@/lib/products-data";

// Shared Open Graph image for every product one-pager (1200×630).
// Generic system fonts (no font fetch) — matches the /espanol OG pattern.
export function buildProductOg(slug: string) {
  const p = getProductBySlug(slug);
  const accent = p?.accent ?? "#c9a96e";
  const brand = p?.brand ?? "MachineMind";
  const accentWord = p?.brandAccentWord;
  const badge = p?.badge;
  const tagline = p?.ogTagline ?? "AI systems that think.";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#06060a",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* accent glow */}
        <div
          style={{
            position: "absolute",
            top: -220,
            left: 120,
            width: 900,
            height: 700,
            display: "flex",
            opacity: 0.22,
            background: `radial-gradient(circle at 50% 50%, ${accent} 0%, transparent 60%)`,
          }}
        />
        {/* top accent rule */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            display: "flex",
            background: `linear-gradient(90deg, transparent 10%, ${accent} 50%, transparent 90%)`,
          }}
        />

        {/* top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          <div style={{ display: "flex", fontSize: 20, letterSpacing: 6, fontWeight: 700, color: "#c9a96e" }}>
            MACHINE<span style={{ display: "flex", color: "#f0f0f3" }}>MIND</span>
          </div>
          {badge ? (
            <div
              style={{
                display: "flex",
                fontSize: 20,
                letterSpacing: 2,
                color: accent,
                border: `1px solid ${accent}`,
                padding: "8px 18px",
                borderRadius: 2,
              }}
            >
              {badge}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
        </div>

        {/* center */}
        <div style={{ display: "flex", flexDirection: "column", position: "relative", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap" }}>
            <span style={{ display: "flex", fontSize: 108, fontWeight: 700, letterSpacing: -3, color: "#f0f0f3", lineHeight: 1 }}>
              {brand}
            </span>
            {accentWord ? (
              <span style={{ display: "flex", fontSize: 108, fontWeight: 700, letterSpacing: -3, color: accent, lineHeight: 1, marginLeft: 20 }}>
                {accentWord}
              </span>
            ) : null}
          </div>
          <div style={{ display: "flex", width: 72, height: 4, background: accent }} />
          <div style={{ display: "flex", fontSize: 34, color: "#b8b4ad", maxWidth: 940, lineHeight: 1.35 }}>
            {tagline}
          </div>
        </div>

        {/* bottom */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
          <div style={{ display: "flex", width: 10, height: 10, borderRadius: 10, background: accent }} />
          <div style={{ display: "flex", fontSize: 22, color: "#6f6b64", letterSpacing: 1 }}>
            AI Automation Consultancy · Cartagena, Colombia
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

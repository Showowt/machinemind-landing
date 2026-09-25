import { ImageResponse } from "next/og";
import { FREE_DAYS, MONTHLY_PRICE_USD } from "@/lib/web-gratis/config";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Su página web, gratis — Iniciativa de Digitalización de Negocios 2026 · El Salvador y Colombia · MachineMind";

/**
 * Link preview for WhatsApp / Facebook shares of /web, /colombia, /elsalvador
 * and referral links. Neutral across both markets; MachineMind's own initiative
 * (no government marks, seals or claims).
 */
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          background: "#06060a",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 900,
            height: 900,
            top: -380,
            left: -200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(30,155,240,0.28) 0%, transparent 62%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 800,
            height: 800,
            top: -300,
            right: -260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(15,71,175,0.35) 0%, transparent 62%)",
            display: "flex",
          }}
        />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "#1e9bf0", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "12px 20px",
              border: "2px solid rgba(30,155,240,0.6)",
              background: "rgba(30,155,240,0.1)",
              fontSize: 24,
              letterSpacing: 5,
              color: "#f0f0f3",
              fontFamily: "sans-serif",
            }}
          >
            INICIATIVA DE DIGITALIZACIÓN DE NEGOCIOS 2026
          </div>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 7, color: "#1e9bf0", fontFamily: "sans-serif" }}>
            EL SALVADOR · COLOMBIA
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 100,
              fontWeight: 700,
              color: "#f0f0f3",
              lineHeight: 1,
              letterSpacing: -3,
              fontFamily: "sans-serif",
              display: "flex",
            }}
          >
            Su página web,
          </div>
          <div
            style={{
              fontSize: 124,
              fontStyle: "italic",
              color: "#1e9bf0",
              lineHeight: 1.05,
              fontFamily: "serif",
              display: "flex",
            }}
          >
            gratis.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.3,
              maxWidth: 780,
              color: "rgba(240,240,243,0.78)",
              fontFamily: "sans-serif",
              display: "flex",
            }}
          >
            {`${FREE_DAYS} días gratis · luego $${MONTHLY_PRICE_USD} USD/mes con hosting y soporte completo, o alójela usted mismo · sin contrato`}
          </div>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 6,
              color: "#f0f0f3",
              fontWeight: 700,
              fontFamily: "sans-serif",
              display: "flex",
            }}
          >
            MACHINEMIND
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

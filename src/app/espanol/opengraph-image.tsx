import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Español OS — Fluency Engine";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0F0E0C",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background texture — subtle radial */}
        <div
          style={{
            position: "absolute",
            width: 800,
            height: 800,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 60%)",
            top: -100,
            left: 200,
            display: "flex",
          }}
        />

        {/* Top border accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, transparent 20%, #C9A84C 50%, transparent 80%)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 60,
          }}
        >
          {/* É mark — large */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
            }}
          >
            {/* Gold accent */}
            <div
              style={{
                fontSize: 50,
                color: "#C9A84C",
                fontFamily: "serif",
                fontWeight: 700,
                lineHeight: 1,
                marginBottom: -32,
                display: "flex",
              }}
            >
              ´
            </div>
            {/* E letter */}
            <div
              style={{
                fontSize: 200,
                fontWeight: 700,
                color: "#EDE8E0",
                fontFamily: "serif",
                lineHeight: 1,
                display: "flex",
                letterSpacing: -6,
              }}
            >
              E
            </div>
            {/* Gold underline */}
            <div
              style={{
                width: 70,
                height: 3,
                borderRadius: 2,
                background: "#C9A84C",
                marginTop: -8,
                display: "flex",
              }}
            />
          </div>

          {/* Text */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Title */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 14,
              }}
            >
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color: "#C9A84C",
                  fontFamily: "serif",
                  letterSpacing: -1,
                }}
              >
                Español
              </span>
              <span
                style={{
                  fontSize: 64,
                  color: "#5A5248",
                  fontFamily: "serif",
                  fontStyle: "italic",
                  fontWeight: 500,
                }}
              >
                OS
              </span>
            </div>

            {/* Divider */}
            <div
              style={{
                width: 50,
                height: 1.5,
                background: "#302D29",
                display: "flex",
              }}
            />

            {/* Subtitle */}
            <div
              style={{
                fontSize: 24,
                color: "#A09485",
                fontFamily: "sans-serif",
                fontWeight: 400,
                lineHeight: 1.6,
                letterSpacing: 0.5,
              }}
            >
              Real conversations. Real corrections.
            </div>
            <div
              style={{
                fontSize: 24,
                color: "#7A6230",
                fontFamily: "sans-serif",
                fontWeight: 400,
                letterSpacing: 0.5,
              }}
            >
              Real fluency.
            </div>
          </div>
        </div>

        {/* Bottom corner — subtle branding */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            right: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: 0.4,
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "#5A5248",
              fontFamily: "sans-serif",
              letterSpacing: 2,
              fontWeight: 600,
            }}
          >
            MACHINEMIND
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

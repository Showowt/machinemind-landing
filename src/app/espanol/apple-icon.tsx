import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#0F0E0C",
          borderRadius: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle gold gradient glow behind the letter */}
        <div
          style={{
            position: "absolute",
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)",
            top: 30,
            left: 30,
            display: "flex",
          }}
        />

        {/* The É mark */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
          }}
        >
          {/* Gold accent mark */}
          <div
            style={{
              fontSize: 28,
              color: "#C9A84C",
              fontFamily: "serif",
              fontWeight: 700,
              lineHeight: 1,
              marginBottom: -18,
              display: "flex",
            }}
          >
            ´
          </div>
          {/* Cream E */}
          <div
            style={{
              fontSize: 110,
              fontWeight: 700,
              color: "#EDE8E0",
              fontFamily: "serif",
              lineHeight: 1,
              display: "flex",
              letterSpacing: -3,
            }}
          >
            E
          </div>
        </div>

        {/* Thin gold line at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 22,
            width: 40,
            height: 2.5,
            borderRadius: 2,
            background: "#C9A84C",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}

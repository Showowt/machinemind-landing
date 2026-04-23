import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#0F0E0C",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* The É — cream letter with gold accent */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#EDE8E0",
            fontFamily: "serif",
            lineHeight: 1,
            display: "flex",
            position: "relative",
            marginTop: -1,
          }}
        >
          É
        </div>
      </div>
    ),
    { ...size }
  );
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Español OS — Fluency Engine",
    short_name: "Español OS",
    description: "Real conversations. Real corrections. Real fluency.",
    start_url: "/espanol",
    display: "standalone",
    background_color: "#0F0E0C",
    theme_color: "#0F0E0C",
    icons: [
      {
        src: "/espanol/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/espanol/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

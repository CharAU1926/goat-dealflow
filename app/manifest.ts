import type { MetadataRoute } from "next";

// PRD v1.6 §7: installable PWA. Colours match the slate-950 app background.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Khora Flow",
    short_name: "KhoraFlow",
    description: "Curated European deal flow for high-conviction investors and ambitious founders.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

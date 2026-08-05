import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "mikke",
    short_name: "mikke",
    description: "MarketNote, Story, DESK, and connected apps by mikke",
    start_url: "/marketnote",
    scope: "/",
    display: "standalone",
    background_color: "#fffdfb",
    theme_color: "#f75a3b",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/mikke-app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/mikke-app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}

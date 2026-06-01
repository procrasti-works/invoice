import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Payvio",
    short_name: "Payvio",
    description:
      "Create, send, approve, and close client invoices from one focused workspace.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#fbfbfc",
    theme_color: "#fbfbfc",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/payvio-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/payvio-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/payvio-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/payvio-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "New invoice",
        short_name: "Invoice",
        description: "Create a Payvio invoice.",
        url: "/dashboard#new-invoice",
        icons: [{ src: "/payvio-app-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Reports",
        short_name: "Reports",
        description: "Open Payvio reports.",
        url: "/dashboard/reports",
        icons: [{ src: "/payvio-app-icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}

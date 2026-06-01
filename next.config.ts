import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
  },
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 1800,
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      // Pojistné podmínky bývají velká PDF — zvýšený limit pro nahrávání přes Server Actions.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;

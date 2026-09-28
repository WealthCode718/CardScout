import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pokemontcg.io" },
      { protocol: "https", hostname: "images.scrydex.com" },
      { protocol: "https", hostname: "tcgplayer-cdn.tcgplayer.com" },
      { protocol: "https", hostname: "**.ebayimg.com" },
    ],
  },
};

export default nextConfig;

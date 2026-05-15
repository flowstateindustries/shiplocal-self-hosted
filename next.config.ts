import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // App icons come from Apple's CDN (is1-ssl.mzstatic.com … is5-ssl.mzstatic.com).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.mzstatic.com",
        pathname: "/image/**",
      },
    ],
  },
};

export default nextConfig;

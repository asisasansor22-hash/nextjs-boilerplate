import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ana sayfa: public/index.html (yengeniz geri sayım sayacı)
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/index.html" }],
    };
  },
};

export default nextConfig;

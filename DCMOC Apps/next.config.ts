import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/dcmoc',
  assetPrefix: '/dcmoc/',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

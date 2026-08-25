import type { NextConfig } from 'next';

const basePath = process.env.PAGES_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  output: 'export',
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

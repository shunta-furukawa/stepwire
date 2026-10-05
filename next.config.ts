import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    '/**': ['./content/**/*'],
  },
  typedRoutes: true,
  async rewrites() {
    // Serve the standalone archive without the blog's React layout.
    return [{ source: '/bpl', destination: '/bpl/index.html' }];
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    '/**': ['./content/**/*', './public/bpl/index.html', './public/fonts/BplShare.ttf', './public/brand/wordmark.svg'],
  },
  typedRoutes: true,
  async rewrites() {
    // Serve the standalone archive without the blog's React layout.
    return [{ source: '/bpl', destination: '/bpl/s' }];
  },
};

export default nextConfig;

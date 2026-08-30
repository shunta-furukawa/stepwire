import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Article content is read from the filesystem at build time. Keeping the
  // heavy native render/bundler packages out of the client & server bundles
  // avoids pulling Remotion's toolchain into the Next.js build graph; the
  // local render path runs them from a plain Node script instead.
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer', '@vercel/sandbox'],
  outputFileTracingIncludes: {
    '/**': ['./content/**/*'],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;

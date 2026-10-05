import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'STEPWIRE',
    short_name: 'STEPWIRE',
    description: 'DDRの記事・譜面解説・BPL戦績',
    lang: 'ja',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0b',
    theme_color: '#0a0a0b',
    icons: [
      { src: '/brand/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: '記事トップ', url: '/' },
      { name: 'BPL戦績', url: '/bpl' },
    ],
  };
}

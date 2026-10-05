import type { Metadata, Viewport } from 'next';
import './globals.css';
import { HomeScreenInstall } from '@/components/HomeScreenInstall';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.taglineJa}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  icons: { icon: "/brand/icon.svg", apple: [{ url: "/brand/icons/icon-180.png", sizes: "180x180" }] },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "STEPWIRE", statusBarStyle: "black-translucent" },
  authors: [{ name: site.operator }],
  creator: site.operator,
  publisher: site.name,
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': `${site.url}/feed.xml` },
  },
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: `${site.name} — ${site.taglineJa}`,
    description: site.description,
    url: site.url,
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — ${site.taglineJa}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = { themeColor: '#0a0a0b', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={site.locale}>
      <body className="min-h-dvh antialiased">
        <Header />
        <HomeScreenInstall />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

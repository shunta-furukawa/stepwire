/** Site-wide constants. Kept in one place so metadata never disagrees. */
export const site = {
  name: 'STEPWIRE',
  tagline: 'DDR News, Charts & Culture.',
  description:
    'STEPWIRE is an independent news and culture wire for DanceDanceRevolution: game updates, new charts, events, tournaments, data and the community around the machine.',
  operator: 'Mono ddr',
  locale: 'en',
  /**
   * Canonical origin. Vercel injects VERCEL_PROJECT_PRODUCTION_URL on every
   * deployment, so production canonicals are correct without configuration;
   * NEXT_PUBLIC_SITE_URL overrides it for a custom domain.
   */
  url: resolveSiteUrl(),
} as const;

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  const preview = process.env.VERCEL_URL;
  if (preview) return `https://${preview}`;

  return 'http://localhost:3000';
}

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, `${site.url}/`).toString();
}

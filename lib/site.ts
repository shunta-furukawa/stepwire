/** Site-wide constants. Kept in one place so metadata never disagrees. */
export const site = {
  name: 'STEPWIRE',
  /** The brand line stays in English: it is a wordmark, not a sentence. */
  tagline: 'DDR News, Charts & Culture.',
  taglineJa: 'DDRのニュース、譜面、カルチャー。',
  description:
    'STEPWIREは、DanceDanceRevolutionを扱う独立系のニュース／カルチャーメディアです。ゲームの更新、新曲と新譜面、イベント、大会、譜面データ、そして筐体のまわりにあるコミュニティを記録します。',
  operator: 'MONO DDR',
  locale: 'ja',
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

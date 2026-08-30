import { getSyndicatableArticles } from '@/lib/content/loader';
import { absoluteUrl, site } from '@/lib/site';
import { CATEGORY_META } from '@/lib/content/categories';

/**
 * RSS 2.0 feed.
 *
 * Statically generated with the rest of the site. Fixture articles are excluded
 * — a sample story must never reach a subscriber's reader.
 */
export const dynamic = 'force-static';

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const articles = await getSyndicatableArticles();
  const latest = articles[0];

  const items = articles
    .map((article) => {
      const url = absoluteUrl(`/article/${article.slug}`);
      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(CATEGORY_META[article.category].label)}</category>
      <description>${escapeXml(article.dek ?? article.summary)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${site.name} — ${site.taglineJa}`)}</title>
    <link>${escapeXml(site.url)}</link>
    <atom:link href="${escapeXml(absoluteUrl('/feed.xml'))}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(site.description)}</description>
    <language>ja</language>
    <copyright>${escapeXml(`© ${new Date().getFullYear()} ${site.name}`)}</copyright>
${latest ? `    <lastBuildDate>${new Date(latest.publishedAt).toUTCString()}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

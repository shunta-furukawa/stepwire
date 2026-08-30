import { ImageResponse } from 'next/og';
import { getArticleBySlug, getArticles } from '@/lib/content/loader';
import { CATEGORY_META } from '@/lib/content/categories';
import { color } from '@/lib/design/tokens';
import { formatDate } from '@/lib/format';

/**
 * Per-article social card.
 *
 * Generated at build time from the same tokens as the site and the video, so a
 * shared link looks like STEPWIRE without anyone exporting an image.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'STEPWIRE article card';

export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  const headline = article?.shortTitle ?? article?.title ?? 'STEPWIRE';
  const category = article ? CATEGORY_META[article.category].label.toUpperCase() : 'WIRE';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: color.surface,
          color: color.fg,
          padding: 64,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              background: color.fg,
              color: color.surface,
              padding: '8px 16px',
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: '-0.03em',
            }}
          >
            STEPWIRE
          </div>
          <div
            style={{
              border: `2px solid ${color.lineStrong}`,
              padding: '6px 14px',
              fontSize: 22,
              letterSpacing: '0.18em',
            }}
          >
            {category}
          </div>
          {article?.fixture ? (
            <div
              style={{
                background: color.accent,
                color: color.onAccent,
                padding: '6px 14px',
                fontSize: 22,
                letterSpacing: '0.18em',
              }}
            >
              SAMPLE
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: headline.length > 64 ? 62 : 80,
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            maxWidth: 1000,
          }}
        >
          {headline}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: `4px solid ${color.accent}`,
            paddingTop: 20,
            fontSize: 24,
            letterSpacing: '0.12em',
          }}
        >
          <div style={{ display: 'flex' }}>DDR NEWS, CHARTS &amp; CULTURE.</div>
          <div style={{ display: 'flex', color: color.faint }}>
            {article ? formatDate(article.publishedAt) : ''}
          </div>
        </div>
      </div>
    ),
    size,
  );
}

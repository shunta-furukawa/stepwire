import type { ArticleVideoInput } from '../content/article';

/**
 * The words that go with the film when it is posted: a title, a description
 * and hashtags, derived from the article so they can never say something the
 * article does not.
 *
 * The description is where the credits the film owes are honoured a second
 * time — a CC BY licence asks for attribution "where people can find it", and
 * a YouTube description is that place — and where every source the article
 * cites is listed, because a viewer who wants to check a claim should not
 * have to find the page first.
 */

export interface PostCopy {
  title: string;
  description: string;
  hashtags: string;
}

/** YouTube truncates a title past this; a title that gets cut is a worse title. */
const TITLE_LIMIT = 100;

const LICENCE_LINES: Record<string, string[]> = {
  'CC BY 4.0': [
    'Licensed under Creative Commons: By Attribution 4.0 License',
    'https://creativecommons.org/licenses/by/4.0/',
  ],
};

/** `EXTRA SAVIOR WORLD` → `#EXTRASAVIORWORLD`; `譜面` → `#譜面`. */
export function hashtag(tag: string): string {
  const cleaned = tag.replace(/[\s\-–—・/]+/g, '').replace(/[^\p{L}\p{N}_]/gu, '');
  return cleaned ? `#${cleaned}` : '';
}

export function postTitle(article: Pick<ArticleVideoInput, 'title' | 'shortTitle'>): string {
  const full = article.title;
  if (full.length <= TITLE_LIMIT) return full;
  return article.shortTitle ?? `${full.slice(0, TITLE_LIMIT - 1)}…`;
}

export function postHashtags(article: Pick<ArticleVideoInput, 'tags' | 'category'>): string {
  const base = ['DDR', 'DanceDanceRevolution', 'STEPWIRE'];
  const own = (article.tags ?? []).map(hashtag).filter(Boolean);
  return [...new Set([...base.map((t) => `#${t}`), ...own])].join(' ');
}

export function postDescription(article: ArticleVideoInput, articleUrl: string): string {
  const parts: string[] = [];

  parts.push(article.dek ?? article.summary);
  parts.push(`記事: ${articleUrl}`);

  const sources = article.sources ?? (article.primarySource ? [article.primarySource] : []);
  if (sources.length > 0) {
    parts.push(
      ['▶ 出典', ...sources.map((s) => `${s.publisher} — ${s.title}\n${s.url}`)].join('\n'),
    );
  }

  const imageCredits = [
    ...new Set(
      [article.heroImage?.credit, ...article.media.map((m) => m.credit)].filter(
        (credit): credit is string => Boolean(credit),
      ),
    ),
  ];
  if (imageCredits.length > 0) {
    parts.push(['▶ 画像', ...imageCredits].join('\n'));
  }

  if (article.bgm) {
    const licence = Object.keys(LICENCE_LINES).find((key) => article.bgm!.credit.includes(key));
    const credit = licence
      ? article.bgm.credit.replace(new RegExp(`\\s*[·・-]\\s*${licence}\\s*$`), '')
      : article.bgm.credit;
    parts.push(['▶ 音楽', credit, ...(licence ? LICENCE_LINES[licence]! : [])].join('\n'));
  }

  parts.push(postHashtags(article));
  return parts.join('\n\n');
}

export function postCopy(article: ArticleVideoInput, articleUrl: string): PostCopy {
  return {
    title: postTitle(article),
    description: postDescription(article, articleUrl),
    hashtags: postHashtags(article),
  };
}

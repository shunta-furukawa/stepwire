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

/**
 * Which film the words go with. The landscape carries the whole article;
 * the vertical is its teaser, so its title is the short one with the
 * platform's tag, its description points at the full version and keeps
 * only what a licence requires, and the sources stay on the article.
 */
export type PostFormat = 'full' | 'teaser';

/** Where the teaser's description asks for the full film's link. */
export const FULL_VIDEO_PLACEHOLDER = '本編: （本編のYouTubeリンクをここに）';

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

export function postHashtags(article: Pick<ArticleVideoInput, 'tags' | 'category'>, format: PostFormat = 'full'): string {
  const base = format === 'teaser' ? ['Shorts', 'DDR', 'STEPWIRE'] : ['DDR', 'DanceDanceRevolution', 'STEPWIRE'];
  const own = (article.tags ?? []).map(hashtag).filter(Boolean);
  const tags = [...new Set([...base.map((t) => `#${t}`), ...own])];
  // A teaser's tags are a line, not a paragraph.
  return (format === 'teaser' ? tags.slice(0, 5) : tags).join(' ');
}

/** The teaser's title: the short one, with the platform's tag on the end. */
export function teaserTitle(article: Pick<ArticleVideoInput, 'title' | 'shortTitle'>): string {
  const base = article.shortTitle ?? article.title;
  const tag = ' #Shorts';
  const room = TITLE_LIMIT - tag.length;
  return `${base.length <= room ? base : `${base.slice(0, room - 1)}…`}${tag}`;
}

export function postDescription(article: ArticleVideoInput, articleUrl: string, format: PostFormat = 'full'): string {
  const parts: string[] = [];

  parts.push(article.dek ?? article.summary);
  if (format === 'teaser') parts.push([
    article.youtubeVideoId ? '続きは、このShortの関連動画から本編へ。' : '続きはSTEPWIREの本編・記事で。',
    article.youtubeVideoId ? `本編: https://www.youtube.com/watch?v=${article.youtubeVideoId}` : FULL_VIDEO_PLACEHOLDER,
    `記事: ${articleUrl}`,
  ].join('\n'));
  else parts.push(`記事: ${articleUrl}`);

  const sources = format === 'teaser' ? [] : (article.sources ?? (article.primarySource ? [article.primarySource] : []));
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

  const clipCredits = [
    ...new Set((article.video?.musicClips ?? []).map((clip) => clip.credit)),
  ];
  if (clipCredits.length > 0) {
    parts.push(['▶ 楽曲クリップ', ...clipCredits].join('\n'));
  }

  parts.push(postHashtags(article, format));
  return parts.join('\n\n');
}

export function postCopy(article: ArticleVideoInput, articleUrl: string, format: PostFormat = 'full'): PostCopy {
  return {
    title: format === 'teaser' ? teaserTitle(article) : postTitle(article),
    description: postDescription(article, articleUrl, format),
    hashtags: postHashtags(article, format),
  };
}

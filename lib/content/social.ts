import type { Article } from './article';
import { absoluteUrl } from '../site';

/** A chosen poster takes precedence; otherwise Next's generated OG card remains the fallback. */
export function articleSocialImage(article: Pick<Article, 'thumbnail' | 'contentHash'>) {
  if (!article.thumbnail) return undefined;
  const image = article.thumbnail;
  const url = new URL(absoluteUrl(image.src));
  // An article update gives crawlers a fresh image URL without changing the article's permalink.
  url.searchParams.set('v', article.contentHash);
  return {
    url: url.toString(),
    alt: image.alt,
    ...(image.width ? { width: image.width } : {}),
    ...(image.height ? { height: image.height } : {}),
  };
}

import { z } from 'zod';

/**
 * Reading a post on X through its official oEmbed endpoint.
 *
 * This is the one way STEPWIRE looks at a post: `publish.twitter.com/oembed`
 * is an API X offers for exactly this, it needs no key, and it returns the
 * author and the text. It is not scraping — see `docs/sources.md` — and it is
 * not the undocumented syndication endpoint, which returns more (the date, the
 * attached pictures) but is not offered to anyone.
 *
 * What it does not return matters: no pictures, no exact time, no quote-tweet
 * body. A picture in a post is fetched by nobody here; the operator saves it
 * and answers for it, as with every other image in the system.
 */

/** `x.com/<handle>/status/<id>`, with or without `www.`, `twitter.com`, a query. */
export const X_POST_URL = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/;

export interface XPost {
  /** Canonical `https://x.com/<handle>/status/<id>`. */
  url: string;
  id: string;
  handle: string;
  /** Display name, as the profile shows it. */
  author: string;
  /** The post's text, with line breaks kept and the trailing media link dropped. */
  text: string;
  /** The day the post was made, `YYYY-MM-DD`, when the embed names it. */
  date?: string;
}

const oembedSchema = z.object({
  url: z.string(),
  author_name: z.string(),
  author_url: z.string(),
  html: z.string(),
});

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
};

function unescape(html: string): string {
  return html.replace(/&(?:amp|lt|gt|quot|#39|nbsp|mdash);/g, (entity) => ENTITIES[entity] ?? entity);
}

/**
 * The post body out of the embed's `<blockquote>`.
 *
 * The embed is one `<p>` of text, then an em-dash line naming the author and
 * the date. Only the paragraph is the post. A `pic.twitter.com` link at the
 * end stands for an attachment and says nothing, so it is dropped; a `t.co`
 * link is kept because it is a link the author chose to include.
 */
export function textFromOembedHtml(html: string): string {
  const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '';
  const text = unescape(
    paragraph
      .replace(/<br\s*\/?>/gi, '\n')
      // A link is rendered inline after the word before it with no space;
      // as text it needs one, or a hashtag and a URL run together.
      .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, ' $1')
      .replace(/<[^>]+>/g, ''),
  );
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/\s*pic\.twitter\.com\/\S+\s*$/i, '')
        .replace(/ {2,}/g, ' ')
        .trim(),
    )
    .join('\n')
    .trim();
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `September 1, 2026` → `2026-09-01`. The embed dates in English. */
export function dateFromOembedHtml(html: string): string | undefined {
  const match = /<\/p>[\s\S]*?>\s*([A-Z][a-z]+) (\d{1,2}), (\d{4})\s*<\/a>/.exec(html);
  if (!match) return undefined;
  const month = MONTHS.indexOf(match[1]!);
  if (month === -1) return undefined;
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[2]!.padStart(2, '0')}`;
}

export function parseOembed(payload: unknown): XPost {
  const data = oembedSchema.parse(payload);
  const match = X_POST_URL.exec(data.url);
  if (!match) throw new Error(`oEmbed returned a URL that is not a post: ${data.url}`);
  const [, handle, id] = match;
  const date = dateFromOembedHtml(data.html);
  return {
    url: `https://x.com/${handle}/status/${id}`,
    id: id!,
    handle: handle!,
    author: data.author_name,
    text: textFromOembedHtml(data.html),
    ...(date ? { date } : {}),
  };
}

export async function fetchXPost(url: string): Promise<XPost> {
  if (!X_POST_URL.test(url)) throw new Error(`not a post URL: ${url}`);
  const endpoint = new URL('https://publish.twitter.com/oembed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('omit_script', 'true');
  endpoint.searchParams.set('dnt', 'true');

  const response = await fetch(endpoint, { redirect: 'follow' });
  if (!response.ok) throw new Error(`oEmbed ${response.status} for ${url}`);
  return parseOembed(await response.json());
}

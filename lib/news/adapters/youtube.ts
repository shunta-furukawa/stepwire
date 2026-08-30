import { z } from 'zod';
import type { RawItem, SourceDefinition } from '../types';
import { stripHtml } from './feed';
import type { AdapterContext, SourceAdapter } from './types';

/**
 * YouTube Data API v3 adapter.
 *
 * YouTube publishes a perfectly good Atom feed at `/feeds/videos.xml`, and this
 * project does not use it: YouTube's `robots.txt` says
 * `Disallow: /feeds/videos.xml` for `User-agent: *`. The collection policy in
 * `docs/sources.md` says robots is checked before a source goes live, and a
 * policy that bends the first time it is inconvenient is not a policy.
 *
 * So official video comes through the documented API instead. It costs an API
 * key and this adapter; it does not cost anyone's goodwill.
 *
 * Why not the generic JSON adapter? Two reasons it cannot cover:
 *   1. The API key is a secret. It has to come from the environment, never from
 *      the committed registry, so the URL is built here rather than configured.
 *   2. The watch URL is not a field in the response — it is constructed from
 *      `resourceId.videoId`, which a field mapping cannot express.
 */

const ENDPOINT = 'https://www.googleapis.com/youtube/v3/playlistItems';

/** `playlistItems.list` costs 1 unit; the default daily quota is 10,000. */
export const QUOTA_COST_PER_CALL = 1;

const optionsSchema = z
  .object({
    /**
     * A channel id (`UC…`). Its uploads playlist is `UU…` — the same id with
     * the prefix swapped, which is a documented property of channel ids.
     */
    channelId: z.string().regex(/^UC[A-Za-z0-9_-]{20,24}$/).optional(),
    /** An explicit playlist id, for a curated playlist rather than uploads. */
    playlistId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.channelId ?? value.playlistId), {
    message: 'a youtube source needs options.channelId or options.playlistId',
  });

export function resolvePlaylistId(options: unknown): string {
  const parsed = optionsSchema.parse(options ?? {});
  if (parsed.playlistId) return parsed.playlistId;
  // UC… → UU…: the uploads playlist of a channel.
  return `UU${parsed.channelId!.slice(2)}`;
}

/**
 * The subset of the documented response this adapter reads.
 *
 * Parsed rather than cast: an API shape that changed should fail loudly on the
 * one source that uses it, not quietly produce items with `undefined` titles.
 */
const responseSchema = z.object({
  items: z
    .array(
      z.object({
        snippet: z.object({
          title: z.string(),
          description: z.string().optional(),
          publishedAt: z.string().optional(),
          channelTitle: z.string().optional(),
          resourceId: z.object({ videoId: z.string().optional() }).optional(),
        }),
        contentDetails: z
          .object({ videoPublishedAt: z.string().optional() })
          .optional(),
      }),
    )
    .default([]),
});

/** Exported so the mapping can be tested without an API key. */
export function parsePlaylistItems(payload: unknown): RawItem[] {
  const parsed = responseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error(
      `unexpected playlistItems response shape: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')} ${issue.message}`)
        .join('; ')}`,
    );
  }

  return parsed.data.items
    .map((entry) => {
      const videoId = entry.snippet.resourceId?.videoId;
      // A playlist can contain a deleted or private video, which arrives with
      // no resourceId. Skip it rather than emitting a broken link.
      if (!videoId) return null;

      const description = entry.snippet.description?.trim();
      // `snippet.publishedAt` is when the video joined the playlist;
      // `contentDetails.videoPublishedAt` is when it was published. For an
      // uploads playlist they usually agree, and the latter is the true one.
      const published =
        entry.contentDetails?.videoPublishedAt ?? entry.snippet.publishedAt;
      const parsedDate = published ? Date.parse(published) : Number.NaN;

      const item: RawItem = {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: entry.snippet.title.trim(),
        ...(description ? { summary: stripHtml(description).slice(0, 600) } : {}),
        ...(Number.isNaN(parsedDate)
          ? {}
          : { publishedAt: new Date(parsedDate).toISOString() }),
        raw: {
          format: 'youtube',
          videoId,
          ...(entry.snippet.channelTitle ? { channel: entry.snippet.channelTitle } : {}),
        },
      };
      return item;
    })
    .filter((item): item is RawItem => item !== null);
}

export const youtubeAdapter: SourceAdapter = {
  type: 'youtube',

  async fetchItems(source: SourceDefinition, context: AdapterContext): Promise<RawItem[]> {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      // The collector turns this into a per-source warning, so an unconfigured
      // key never stops the other sources from being collected.
      throw new Error(
        'YOUTUBE_API_KEY is not set — see .env.example and docs/sources.md',
      );
    }

    const url = new URL(ENDPOINT);
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('playlistId', resolvePlaylistId(source.options));
    url.searchParams.set('maxResults', String(Math.min(source.maxItems ?? 10, 50)));
    url.searchParams.set('key', key);

    const response = await context.fetch(url.toString(), {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text();
      // The key is in the query string; keep it out of logs and issue bodies.
      const message = extractApiError(body) ?? `${response.status} ${response.statusText}`;
      throw new Error(`YouTube API request failed: ${message}`);
    }

    return parsePlaylistItems(await response.json());
  },
};

/** Pulls Google's error `reason` out of a failed response, ignoring the rest. */
export function extractApiError(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    const reason = parsed.error?.errors?.[0]?.reason;
    const message = parsed.error?.message;
    if (reason && message) return `${reason} — ${message}`;
    return reason ?? message;
  } catch {
    return undefined;
  }
}

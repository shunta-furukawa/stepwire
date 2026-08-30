import { renderObjectPath } from './render-request';

/**
 * Render output storage.
 *
 * Vercel Blob is the store. It is also the source of truth for "has this
 * already been rendered?": a serverless function has no shared memory, so the
 * only reliable cross-instance duplicate check is asking the store whether the
 * object exists. That check is what actually prevents double billing.
 */

export interface StoredRender {
  url: string;
  pathname: string;
  size?: number;
  uploadedAt?: string;
}

export function blobConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

/** Returns the stored render for this id, or undefined if there is none. */
export async function findExistingRender(renderId: string): Promise<StoredRender | undefined> {
  if (!blobConfigured()) return undefined;

  const { head } = await import('@vercel/blob');
  try {
    const result = await head(renderObjectPath(renderId));
    return {
      url: result.url,
      pathname: result.pathname,
      size: result.size,
      uploadedAt:
        result.uploadedAt instanceof Date ? result.uploadedAt.toISOString() : undefined,
    };
  } catch {
    // `head` throws BlobNotFoundError for a missing object; anything else here
    // (a bad token, a network blip) should also fall through to "render it",
    // since a spurious re-render is safer than reporting a stale URL.
    return undefined;
  }
}

export async function uploadRender(
  renderId: string,
  body: Buffer | ReadableStream,
): Promise<StoredRender> {
  if (!blobConfigured()) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not set — cannot upload the render');
  }

  const { put } = await import('@vercel/blob');
  const result = await put(renderObjectPath(renderId), body, {
    access: 'public',
    contentType: 'video/mp4',
    // The pathname already carries a content hash, so a random suffix would
    // only break the duplicate check.
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });

  return { url: result.url, pathname: result.pathname };
}

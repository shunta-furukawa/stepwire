/**
 * Decodes the pictures a film needs before its first frame is drawn.
 *
 * A frame renderer that awaits the network drops frames, so every picture is
 * fetched and decoded up front and handed to the renderer as a cache. A
 * picture that fails to load is left out rather than failing the export: the
 * renderer draws a labelled gap for it, which the operator sees.
 */
export async function loadImages(sources: Iterable<string>): Promise<Map<string, CanvasImageSource>> {
  const images = new Map<string, CanvasImageSource>();
  await Promise.all(
    [...new Set(sources)].map(async (src) => {
      try {
        const response = await fetch(`/${src.replace(/^\//, '')}`);
        if (!response.ok) return;
        images.set(src, await createImageBitmap(await response.blob()));
      } catch {
        // Left out on purpose; see above.
      }
    }),
  );
  return images;
}

import { font } from '../../design/tokens';

/**
 * Loads the faces a canvas draws with, before it draws.
 *
 * A canvas paints with whatever the browser has at that instant: a face
 * declared in CSS but not yet fetched falls back silently, and the first
 * thumbnail of a session comes out in the system gothic. So every drawer's
 * caller awaits this first. Idempotent and cheap once the face is cached;
 * a failure (no `document.fonts`, an offline studio) resolves anyway — the
 * fallback stack is a plainer card, not a broken one.
 */
export async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const impact = font.impact.split(',')[0]?.trim() ?? '';
  try {
    await Promise.all([
      document.fonts.load(`400 100px ${impact}`, 'STEPWIRE'),
      document.fonts.load(`400 100px ${impact}`, 'あ'),
    ]);
  } catch {
    // See above: the fallback is the system stack.
  }
}

/**
 * Text shaping for video headlines.
 *
 * Pure string logic, so it lives beside the rest of the scene derivation rather
 * than inside a Remotion component — and can be tested without rendering.
 */

const CJK_RANGE = /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF00-\uFFEF]/;
const CJK_CLOSING = /[、。！？，・）」』】]/;

/**
 * Text length weighted by how much room it actually takes.
 *
 * A CJK glyph fills its em box; a Latin character averages about half of one.
 * So the same character count is roughly twice as much text on screen — and
 * twice as long to read — in Japanese as in English. Counting CJK characters
 * twice gives one measure that both the card budget and the reading-time
 * estimate can use, so neither has to know which language it is looking at.
 */
export function visualLength(text: string): number {
  let length = 0;
  for (const character of text) {
    length += CJK_RANGE.test(character) ? 2 : 1;
  }
  return length;
}


/**
 * Splits a headline into reveal units.
 *
 * Latin splits on spaces. Japanese has none, so a whole headline would arrive
 * as one block and the reveal would read as a plain fade. Splitting after
 * closing punctuation and then at each kanji/katakana → hiragana boundary
 * approximates bunsetsu — the phrase units a reader actually takes in at once.
 *
 *   "【SAMPLE】DDR WORLD、夏のアップデートでスコア表示を刷新"
 *   → 【SAMPLE】· DDR · WORLD、· 夏の · アップデートで · スコア表示を · 刷新
 */
export function splitForReveal(text: string): string[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => token.split(new RegExp(`(?<=${CJK_CLOSING.source})`)))
    .flatMap((piece) =>
      CJK_RANGE.test(piece)
        ? (piece.match(/[^\u3040-\u309F]+[\u3040-\u309F]*|[\u3040-\u309F]+/g) ?? [piece])
        : [piece],
    )
    .filter((piece) => piece.length > 0);
}

/** True when a word space belongs between two reveal units. */
export function needsSpaceBetween(current: string, next: string | undefined): boolean {
  if (!next) return false;
  return !CJK_RANGE.test(current.slice(-1)) && !CJK_RANGE.test(next.charAt(0));
}

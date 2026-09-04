/**
 * Line breaking for a canvas.
 *
 * `ctx.fillText` draws one line and nothing else — a canvas has no line
 * breaking, no `word-break`, and no kinsoku. The DOM gave all of that away for
 * free; a canvas renderer has to do it by hand, and doing it badly is the
 * fastest way to make Japanese look wrong.
 *
 * Kept pure, with measurement injected, so it is testable as data rather than
 * by rendering — the same rule the scene derivation follows.
 */

const CJK =
  /[　-〿぀-ヿ㐀-䶿一-鿿＀-￯ㇰ-ㇿ]/;

/**
 * 行頭禁則 — characters that may not begin a line. A line breaks *before* the
 * character that overflows, which is exactly how a closing bracket or a full
 * stop ends up stranded at the start of the next line.
 */
const NEVER_STARTS_A_LINE = new Set(
  '、。，．・：；？！ー〜ゝゞヽヾ々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ）］｝」』】〉》〕”’%）,.:;?!'.split(''),
);

/** 行末禁則 — characters that may not end a line. */
const NEVER_ENDS_A_LINE = new Set('（［｛「『【〈《〔“‘（'.split(''));

export type Measure = (text: string) => number;

/**
 * Splits text into the smallest units a line may break between.
 *
 * Latin breaks on spaces, because breaking mid-word is wrong in every Latin
 * script. Japanese breaks between any two characters, because that is how
 * Japanese is set — a per-word rule would need a dictionary and would still be
 * wrong at the places that matter.
 */
export function toBreakUnits(text: string): string[] {
  const units: string[] = [];
  let latin = '';

  const flush = () => {
    if (latin.length > 0) {
      units.push(latin);
      latin = '';
    }
  };

  for (const char of text) {
    if (char === '\n') {
      flush();
      units.push('\n');
      continue;
    }
    if (CJK.test(char)) {
      flush();
      units.push(char);
      continue;
    }
    if (char === ' ') {
      // The space belongs to the unit before it, and ends it: a line never
      // begins with a space, and `latin` must not keep growing across one or
      // an entire sentence becomes a single unbreakable unit.
      if (latin.length > 0) {
        latin += char;
        flush();
      } else if (units.length > 0) {
        units[units.length - 1] += char;
      }
      continue;
    }
    latin += char;
  }
  flush();

  return units;
}

/**
 * Greedy line breaking with kinsoku.
 *
 * `maxWidth` is a soft limit in the two cases kinsoku demands it: a line may
 * run slightly long rather than begin with 。 or end with 「. Overflowing by one
 * character reads as correct typesetting; the alternative reads as a bug.
 */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  let line = '';

  for (const unit of toBreakUnits(text)) {
    if (unit === '\n') {
      lines.push(line.trimEnd());
      line = '';
      continue;
    }

    if (line.length === 0) {
      line = unit;
      continue;
    }

    if (measure(line + unit) <= maxWidth) {
      line += unit;
      continue;
    }

    // The unit does not fit. Two kinsoku rules can override the break.
    //
    // Both test a CHARACTER, not the unit: a unit carries any trailing space
    // with it, so `。 ` is a real unit and a whole-string lookup silently misses
    // it — which put 。 at the head of a line everywhere two sentences had been
    // packed onto one card.
    if (NEVER_STARTS_A_LINE.has([...unit][0] ?? '')) {
      line += unit;
      continue;
    }

    const trimmed = line.trimEnd();
    const last = trimmed.at(-1) ?? '';
    if (NEVER_ENDS_A_LINE.has(last) && trimmed.length > 1) {
      lines.push(trimmed.slice(0, -1).trimEnd());
      line = last + unit;
      continue;
    }

    lines.push(line.trimEnd());
    line = unit;
  }

  if (line.length > 0) lines.push(line.trimEnd());
  return lines;
}

/**
 * How much of each wrapped line is on screen when `limit` characters of the
 * text have been typed.
 *
 * The lines were wrapped from the full text, so typing walks the same lines
 * and stops. The one subtlety is the break itself: wrapping Latin text
 * consumes a space at each break, which the typed count still includes;
 * wrapping Japanese consumes nothing. The break is charged only when the
 * source text actually has whitespace there — assuming a space at every break
 * silently loses the last character of every wrapped Japanese line.
 */
export function typedLines(text: string, lines: string[], limit: number): string[] {
  const chars = [...text];
  let position = 0;
  let remaining = limit;
  const shown: string[] = [];

  for (const line of lines) {
    if (remaining <= 0) break;
    const units = [...line];
    shown.push(remaining >= units.length ? line : units.slice(0, remaining).join(''));
    remaining -= units.length;
    position += units.length;
    // Whitespace the wrap dropped between this line and the next.
    while (position < chars.length && /\s/.test(chars[position]!)) {
      position += 1;
      remaining -= 1;
    }
  }
  return shown;
}

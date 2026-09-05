/**
 * The two voices of a session write-up.
 *
 * A session is told as a conversation: WIRE, the site's assistant, asks and
 * counts; MONO, the operator, answers. The split is editorial before it is
 * visual — a line is either the operator's words or the assistant's, and the
 * page and the film both say which. WIRE is an AI and is labelled as one;
 * nothing WIRE says is a source, and WIRE never speaks for MONO.
 *
 * A turn is a paragraph that opens with the speaker's name and a colon:
 *
 *   WIRE: 3曲ともEXPERTで踏んでますね。
 *   MONO: はい。1回目はGREATが1つで悔しくて。
 *   WIRE(grin): それで2回目、999,200。
 *
 * The parenthesised mood is WIRE's expression on the card and is optional;
 * MONO has no expressions — the operator's face is the operator's own.
 */

export const SPEAKERS = ['MONO', 'WIRE'] as const;
export type Speaker = (typeof SPEAKERS)[number];

/** WIRE's faces. The default is `neutral`; the writer picks the rest. */
export const MOODS = ['neutral', 'grin', 'surprise', 'think', 'wink'] as const;
export type Mood = (typeof MOODS)[number];

const TURN_PREFIX = /^(MONO|WIRE)(?:\(([a-z]+)\))?[:：]\s*/;

/**
 * Splits `WIRE(grin): text` into its parts, or returns `null` for a line
 * that is not a turn. An unknown mood is a mistake the writer should see, so
 * it throws rather than falling back to a face the writer did not choose.
 */
export function parseTurnPrefix(line: string): { speaker: Speaker; mood: Mood; rest: string } | null {
  const match = TURN_PREFIX.exec(line);
  if (!match) return null;
  const speaker = match[1] as Speaker;
  const moodTag = match[2];
  if (moodTag !== undefined && !MOODS.includes(moodTag as Mood)) {
    throw new Error(`Unknown mood "${moodTag}" — one of ${MOODS.join(', ')}`);
  }
  if (moodTag !== undefined && speaker === 'MONO') {
    throw new Error('MONO has no moods; only WIRE takes a (mood)');
  }
  return { speaker, mood: (moodTag as Mood | undefined) ?? 'neutral', rest: line.slice(match[0].length) };
}

import { z } from 'zod';

/**
 * Figures — the diagrams an article can carry.
 *
 * The tempting version of this feature is "AI reads the transcript and draws a
 * chart". That is where quality goes to die: a generated figure is confidently
 * wrong in ways prose is not, and a wire that publishes a wrong number has done
 * more damage than one that published nothing.
 *
 * So the direction is inverted. **The article declares the data; the system
 * draws it.** The rendering is deterministic and on-brand, the numbers are
 * reviewed in a pull request like any other claim, and the most an automated
 * tool may ever do is *propose* the rows for a human to confirm.
 *
 * Figures live at the top level of the frontmatter rather than under `video`,
 * because they belong to the article: the page and the video draw the same
 * data, and a figure that existed only in the video would be information the
 * article omits.
 */

const baseFigure = {
  /** Short title, set in the mono "wire" voice. */
  title: z.string().min(1).max(60).optional(),
  /** One line under the figure. Attribution, caveat, or unit note. */
  caption: z.string().min(1).max(160).optional(),
};

/**
 * A row of headline numbers: BPM, level, song count. The shape DDR coverage
 * needs most often, and the one that survives being read on a phone.
 */
export const statFigureSchema = z.object({
  kind: z.literal('stat'),
  ...baseFigure,
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(24),
        value: z.string().min(1).max(12),
        note: z.string().min(1).max(40).optional(),
      }),
    )
    .min(1)
    .max(4),
});

/**
 * A comparison. Values are numbers so the bars are drawn to scale rather than
 * to whatever length looked right — a chart that lies about proportion is worse
 * than a table.
 */
export const barsFigureSchema = z.object({
  kind: z.literal('bars'),
  ...baseFigure,
  /** Appended to each value, e.g. "BPM". */
  unit: z.string().max(8).optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(32),
        value: z.number().finite(),
        /** Marks the row the story is about. */
        highlight: z.boolean().optional(),
      }),
    )
    .min(2)
    .max(6),
});

/** A sequence of dated events: an update history, an event schedule. */
export const timelineFigureSchema = z.object({
  kind: z.literal('timeline'),
  ...baseFigure,
  items: z
    .array(
      z.object({
        /** Free text rather than a date: "2026.08", "第3節", "未定" all occur. */
        at: z.string().min(1).max(20),
        label: z.string().min(1).max(48),
        note: z.string().min(1).max(60).optional(),
        highlight: z.boolean().optional(),
      }),
    )
    .min(2)
    .max(6),
});

export const figureSchema = z.discriminatedUnion('kind', [
  statFigureSchema,
  barsFigureSchema,
  timelineFigureSchema,
]);

export type Figure = z.infer<typeof figureSchema>;
export type StatFigure = z.infer<typeof statFigureSchema>;
export type BarsFigure = z.infer<typeof barsFigureSchema>;
export type TimelineFigure = z.infer<typeof timelineFigureSchema>;

/**
 * Bar lengths as fractions of the longest bar.
 *
 * Shared by the page and the video so a bar is never a different length on the
 * two surfaces. Baselined at zero when every value is positive — starting a bar
 * chart anywhere else exaggerates differences, which is the most common way a
 * chart misleads without stating anything false.
 */
export function barFractions(figure: BarsFigure): number[] {
  const values = figure.items.map((item) => item.value);
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min;

  if (span === 0) return values.map(() => 1);
  return values.map((value) => (value - min) / span);
}

/** `300 BPM`, or just `300` when the figure declares no unit. */
export function formatBarValue(figure: BarsFigure, value: number): string {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return figure.unit ? `${formatted} ${figure.unit}` : formatted;
}

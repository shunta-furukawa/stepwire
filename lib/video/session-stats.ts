import type { Figure } from '../content/figures';
import type { Session } from '../content/schema';
import { DIFFICULTIES, type DifficultyName as Difficulty } from '../content/figures';

/**
 * A session, as numbers the opening card can animate.
 *
 * Nothing here is inferred from prose. The operator declares the session
 * (date, window, weather, flare skill) and the plays (the session-log figure);
 * this only counts and averages what was declared, the way `barFractions`
 * only divides. A number the operator did not write cannot appear, and a
 * number that does appear can be checked against the frontmatter.
 */

export interface SessionStats {
  /** `2026.09.03` */
  date: string;
  /** `WED` — in the session's own calendar, not the viewer's. */
  weekday: string;
  /** `19:08 → 19:37`, when both ends are declared. */
  window?: string;
  /** Minutes between the ends, when both are declared. */
  minutes?: number;
  weather?: string;
  venue?: string;
  style: Session['style'];
  /** Charts played — one per row of the session log. */
  charts: number;
  /** Mean level over the rows that declare one, to a tenth. */
  averageLevel?: number;
  /** Rows the operator flagged as a personal best, one per chart. */
  personalBests: number;
  flare?: { before: number; after: number; delta: number };
  best?: { song: string; score: number };
  /** Rows per difficulty, in the game's order, zeros dropped. */
  byDifficulty: { difficulty: Difficulty; count: number }[];
  /** Rows per rank, best rank first, as declared. */
  byRank: { rank: string; count: number }[];
  /** Every play in order: what the bar chart draws. */
  plays: { song: string; score: number; difficulty: Difficulty; rank?: string; pb: boolean }[];
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const RANK_ORDER = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'E'];

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function sessionStats(session: Session, figures: Figure[]): SessionStats {
  // The session log is the first plays figure: the one that lists every play.
  const log = figures.find((figure) => figure.kind === 'plays');
  const rows = log && log.kind === 'plays' ? log.items : [];

  const [year, month, day] = session.date.split('-').map(Number);
  // Day-of-week from the civil date alone; `Date.UTC` avoids the viewer's zone.
  const weekday = WEEKDAYS[new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay()] ?? '';

  const levels = rows.flatMap((row) => (row.level ? [row.level] : []));
  const averageLevel =
    levels.length > 0 ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : undefined;

  const pbCharts = new Set(rows.filter((row) => row.pb).map((row) => `${row.song}:${row.difficulty}`));

  const best = rows.reduce<SessionStats['best']>(
    (top, row) => (top && top.score >= row.score ? top : { song: row.song, score: row.score }),
    undefined,
  );

  const byDifficulty = DIFFICULTIES.map((difficulty) => ({
    difficulty,
    count: rows.filter((row) => row.difficulty === difficulty).length,
  })).filter((entry) => entry.count > 0);

  const rankCounts = new Map<string, number>();
  for (const row of rows) if (row.rank) rankCounts.set(row.rank, (rankCounts.get(row.rank) ?? 0) + 1);
  const byRank = [...rankCounts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => {
      const ia = RANK_ORDER.indexOf(a.rank);
      const ib = RANK_ORDER.indexOf(b.rank);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  const minutes =
    session.start && session.end ? Math.max(0, minutesOf(session.end) - minutesOf(session.start)) : undefined;

  return {
    date: session.date.replace(/-/g, '.'),
    weekday,
    ...(session.start && session.end ? { window: `${session.start} → ${session.end}` } : {}),
    ...(minutes !== undefined ? { minutes } : {}),
    ...(session.weather ? { weather: session.weather } : {}),
    ...(session.venue ? { venue: session.venue } : {}),
    style: session.style,
    charts: rows.length,
    ...(averageLevel !== undefined ? { averageLevel } : {}),
    personalBests: pbCharts.size,
    ...(session.flareSkill
      ? {
          flare: {
            before: session.flareSkill.before,
            after: session.flareSkill.after,
            delta: session.flareSkill.after - session.flareSkill.before,
          },
        }
      : {}),
    ...(best ? { best } : {}),
    byDifficulty,
    byRank,
    plays: rows.map((row) => ({
      song: row.song,
      score: row.score,
      difficulty: row.difficulty,
      ...(row.rank ? { rank: row.rank } : {}),
      pb: Boolean(row.pb),
    })),
  };
}

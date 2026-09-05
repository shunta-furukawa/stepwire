import { describe, expect, it } from 'vitest';
import type { Figure } from '../lib/content/figures';
import type { Session } from '../lib/content/schema';
import { sessionStats } from '../lib/video/session-stats';

const session: Session = {
  date: '2026-09-03',
  start: '19:08',
  end: '19:37',
  venue: '普段行かないゲーセン',
  style: 'SINGLE',
};

const log: Figure = {
  kind: 'plays',
  items: [
    { song: 'A', difficulty: 'EXPERT', style: 'SINGLE', level: 13, score: 996830, rank: 'AAA' },
    { song: 'A', difficulty: 'EXPERT', style: 'SINGLE', level: 13, score: 999200, rank: 'AAA', pb: true },
    { song: 'B', difficulty: 'EXPERT', style: 'SINGLE', score: 920850, rank: 'AA' },
    { song: 'C', difficulty: 'DIFFICULT', style: 'SINGLE', level: 14, score: 989490, rank: 'AA+' },
    { song: 'D', difficulty: 'CHALLENGE', style: 'SINGLE', level: 15, score: 597150, rank: 'E', pb: true },
    // The same chart twice as a personal best counts once: it is one chart.
    { song: 'D', difficulty: 'CHALLENGE', style: 'SINGLE', level: 15, score: 610000, rank: 'E', pb: true },
  ],
};

describe('sessionStats', () => {
  it('counts what the operator declared and nothing else', () => {
    const stats = sessionStats(session, [log]);
    expect(stats.date).toBe('2026.09.03');
    expect(stats.weekday).toBe('THU');
    expect(stats.window).toBe('19:08 → 19:37');
    expect(stats.minutes).toBe(29);
    expect(stats.venue).toBe('普段行かないゲーセン');
    expect(stats.weather).toBeUndefined();
    expect(stats.charts).toBe(6);
    // (13 + 13 + 14 + 15 + 15) / 5, to a tenth; the unlevelled row is skipped.
    expect(stats.averageLevel).toBe(14);
    expect(stats.personalBests).toBe(2);
    expect(stats.best).toEqual({ song: 'A', score: 999200 });
    expect(stats.flare).toBeUndefined();
  });

  it('orders the mixes the way the game does', () => {
    const stats = sessionStats(session, [log]);
    expect(stats.byDifficulty).toEqual([
      { difficulty: 'DIFFICULT', count: 1 },
      { difficulty: 'EXPERT', count: 3 },
      { difficulty: 'CHALLENGE', count: 2 },
    ]);
    expect(stats.byRank.map((entry) => entry.rank)).toEqual(['AAA', 'AA+', 'AA', 'E']);
    expect(stats.plays.map((play) => play.pb)).toEqual([false, true, false, false, true, true]);
  });

  it('reports the flare skill as a delta when a before was declared', () => {
    const stats = sessionStats({ ...session, flareSkill: { before: 1200, after: 1260 } }, [log]);
    expect(stats.flare).toEqual({ before: 1200, after: 1260, delta: 60 });
  });

  it('stands on a flare skill with no before — the first session has none', () => {
    const stats = sessionStats({ ...session, flareSkill: { after: 88894, rank: 'SUN' } }, [log]);
    expect(stats.flare).toEqual({ after: 88894, rank: 'SUN' });
  });

  it('counts the flare ranks EX first and leaves out rows without one', () => {
    const withFlare: Figure = {
      kind: 'plays',
      items: [
        { song: 'A', difficulty: 'EXPERT', style: 'SINGLE', score: 999200, flare: 'IX' },
        { song: 'B', difficulty: 'EXPERT', style: 'SINGLE', score: 990000, flare: 'EX' },
        { song: 'C', difficulty: 'EXPERT', style: 'SINGLE', score: 980000 },
        { song: 'D', difficulty: 'EXPERT', style: 'SINGLE', score: 970000, flare: 'EX' },
      ],
    };
    const stats = sessionStats(session, [withFlare]);
    expect(stats.byFlare).toEqual([
      { flare: 'EX', count: 2 },
      { flare: 'IX', count: 1 },
    ]);
    expect(stats.plays.map((play) => play.flare)).toEqual(['IX', 'EX', undefined, 'EX']);
    expect(sessionStats(session, [log]).byFlare).toEqual([]);
  });

  it('takes the weekday from the civil date, not the viewer’s zone', () => {
    expect(sessionStats({ date: '2026-01-01', style: 'SINGLE' }, []).weekday).toBe('THU');
    expect(sessionStats({ date: '2026-09-06', style: 'DOUBLE' }, []).weekday).toBe('SUN');
  });

  it('stands on a session with no log', () => {
    const stats = sessionStats({ date: '2026-09-03', style: 'SINGLE' }, []);
    expect(stats.charts).toBe(0);
    expect(stats.averageLevel).toBeUndefined();
    expect(stats.best).toBeUndefined();
    expect(stats.minutes).toBeUndefined();
    expect(stats.plays).toEqual([]);
  });
});

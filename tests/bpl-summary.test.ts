import { describe, expect, it } from 'vitest';
import data from '../public/bpl/data.json';
import inventory from '../docs/bpl-generated-portraits.json';
import { shareModel, summaryRevision, summaryVersion } from '../lib/bpl/share';
import { type ArchiveMatch, playerSummary, portraitFor, teamRoster, teamSummary, winRate } from '../lib/bpl/summary';

const card = (view: string, id: string, extra: Record<string, string> = {}) => shareModel(new URLSearchParams({ view, id, ...extra }));

describe('entity-specific BPL summaries', () => {
  it('counts player appearances once per match and separates Single from Duo', () => {
    const summary = playerSummary('O4MA.', data.matches);
    expect(summary).toEqual({ matches: 20, wins: 10, draws: 0, losses: 4, songs: 14, rate: 71, firsts: 21, duoSongs: 38 });
    const player = card('player', 'O4MA.');
    expect(player.entity?.kind).toBe('player');
    expect(player.description).toContain('通算個人成績');
    expect(player.description).toContain('Single 10勝 0分 4敗（14楽曲）');
    expect(player.description).toContain('Duo個人1位 21/38楽曲');
    expect(player.description).toContain('S6所属');
    expect(player.description).toContain('S6結果非表示');
  });

  it('uses wins/(wins+losses), not total tracks, and leaves undecided rates blank', () => {
    expect(winRate(2, 1)).toBe(67);
    expect(winRate(0, 0)).toBeNull();
    expect(winRate(0, 3)).toBe(0);
    expect(winRate(3, 0)).toBe(100);
    const match: ArchiveMatch = structuredClone(data.matches.find(m => m.battles.some(b => b.type === 'single' && b.songs.length))!);
    const battle = match.battles.find(b => b.type === 'single' && b.songs.length)!;
    match.battles = [battle];
    battle.players = [['TEST'], ['OTHER']];
    const song = battle.songs[0]!;
    battle.songs = [
      { ...song, scores: [100, 90] }, { ...song, scores: [100, 100] },
      { ...song, scores: [100, 110] }, { ...song, scores: [200, 190] },
      { ...song, scores: [null, 100] },
    ];
    expect(playerSummary('TEST', [match])).toMatchObject({ matches: 1, wins: 2, draws: 1, losses: 1, songs: 4, rate: 67, duoSongs: 0 });
    battle.songs = [{ ...song, scores: [100, 100] }];
    expect(playerSummary('TEST', [match]).rate).toBeNull();
    match.season = 0;
    expect(playerSummary('TEST', [match])).toMatchObject({ matches: 1, songs: 0, rate: null });
  });

  it('counts Duo individual first places without inventing pair wins or adding team points', () => {
    const match: ArchiveMatch = structuredClone(data.matches.find(m => m.battles.some(b => b.type === 'tag' && b.songs.length))!);
    const battle = match.battles.find(b => b.type === 'tag' && b.songs.length)!;
    match.battles = [battle];battle.players = [['TEST', 'PARTNER'], ['OTHER', 'OTHER2']];
    const song = battle.songs[0]!;
    battle.songs = [{ ...song, individual: [{ player: 'TEST', team: 0, score: 100, rank: 1 }, { player: 'OTHER', team: 1, score: 100, rank: 1 }] }];
    expect(playerSummary('TEST', [match])).toMatchObject({ songs: 0, wins: 0, firsts: 1, duoSongs: 1, rate: null });
  });

  it('does not manufacture results for new S6 registrants', () => {
    for (const id of ['DIS', 'NOVIN', 'KIKUCHI']) {
      const summary = card('player', id);
      expect(summary.entity?.stats).toMatchObject({ matches: 0, wins: 0, draws: 0, losses: 0, rate: null });
      expect(summary.metric).toContain('勝率—');
      expect(summary.detail).toContain('S6所属');
    }
  });

  it('keeps the selected roster season separate from all-time team statistics', () => {
    const s4 = card('team', 'apina_vrames', { rosterSeason: '4' });
    const s6 = card('team', 'apina_vrames', { rosterSeason: '6' });
    expect(s4.entity?.stats).toEqual(s6.entity?.stats);
    expect(s4.entity?.stats).toMatchObject({ matches: 15, wins: 4, draws: 2, losses: 9, titles: 0 });
    expect(s4.detail).toContain('通算チーム戦績 / S4所属選手');
    if (s4.entity?.kind !== 'team' || s6.entity?.kind !== 'team') throw new Error('Expected teams');
    expect(s4.entity.roster.members.map(p => p.id).sort()).toEqual(['NOTTY', 'PO', 'RINBO-']);
    expect(s6.entity.roster.members).toHaveLength(4);
    expect(card('team', 'leisure_land').title).toBe('LEISURELAND');
  });

  it('normalizes unavailable legacy roster scopes to the same visible default', () => {
    for (const rosterSeason of ['all', '0', '4', '6']) {
      expect(card('team', 'supernova_tohoku', { rosterSeason }).params.get('rosterSeason')).toBe('2');
    }
    expect(teamRoster('WHITE', 'all').season).toBe(0);
    expect(teamRoster('apina_vrames', '4').season).toBe(4);
  });

  it('retains ZERO match-level records without mixing them into song statistics', () => {
    const zero = card('team', 'WHITE');
    expect(zero.entity?.stats).toMatchObject({ matches: 3, wins: 2, draws: 0, losses: 1, titles: 1 });
    expect(zero.params.get('rosterSeason')).toBe('0');
    const matches = data.matches.filter(m => m.season === 0);
    expect(playerSummary('O4MA.', matches)).toMatchObject({ matches: 3, wins: 0, songs: 0, firsts: 0, rate: null });
  });

  it('respects the caller’s result scope if future S6 matches are added', () => {
    const future = structuredClone(data.matches.find(m => m.teams.includes('round1'))!);
    future.id = 's6-test';future.season = 6;
    const visible = [...data.matches, future], hidden = visible.filter(m => m.season !== 6);
    expect(teamSummary('round1', visible).matches).toBe(teamSummary('round1', hidden).matches + 1);
    const participant = future.battles[0]!.players[0]![0]!;
    expect(playerSummary(participant, visible).matches).toBe(playerSummary(participant, hidden).matches + 1);
    expect(card('player', participant, { hideResults: '0' }).detail).not.toContain('S6結果非表示');
  });

  it('uses only the inventoried portrait mapped to each player', () => {
    const portraits = inventory.portraits as Record<string, { src: string }>;
    for (const player of data.players) expect(portraitFor(player.id)).toBe(portraits[player.id]?.src);
    for (const id of ['missing', '__proto__', '../photo']) expect(portraitFor(id)).toBeNull();
  });

  it('gives every entity its own canonical params and a stable data-versioned image identity', () => {
    expect(summaryRevision).toMatch(/^[a-f0-9]{16}$/);
    for (const player of data.players) {
      const m = card('player', player.id);
      expect(m.title).toBe(player.name);
      expect(m.params.get('id')).toBe(player.id);
      expect(m.params.get('summaryVersion')).toBe(summaryVersion);
      expect(card('player', player.id, { summaryVersion: 'old' }).params.toString()).toBe(m.params.toString());
    }
    expect(card('team', 'gigo').params.toString()).not.toBe(card('team', 'round1').params.toString());
  });
});

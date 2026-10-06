import data from '../../public/bpl/data.json';
import brand from '../../public/bpl/brand.json';
import portraits from '../../docs/bpl-generated-portraits.json';

// A narrow input shape also lets future/edge records exercise the same aggregation.
export interface ArchiveMatch {
  season: number;
  stage: string;
  teams: string[];
  points: number[];
  battles: {
    type: string;
    players: string[][];
    songs: {
      scores: (number | null)[];
      individual: { player: string; team: number; score: number | null; rank: number }[];
    }[];
  }[];
}
const players: Record<string, { illustration?: string }> = brand.players;
const inventory: Record<string, { src: string; sha256: string }> = portraits.portraits;
const teams: Record<string, { name: string }> = data.teams;
const branding: Record<string, { color: string; currentName?: string }> = brand.teams;

export const seasonName = (season: number | string) => String(season) === '0' ? 'ZERO' : `S${season}`;
export const teamName = (id: string, season: number) =>
  (season === 6 ? branding[id]?.currentName : undefined) || teams[id]?.name || id;
export const winRate = (wins: number, losses: number) => wins + losses ? Math.round(wins / (wins + losses) * 100) : null;

export function portraitFor(id: string) {
  const path = players[id]?.illustration;
  // Only the reviewed, locally inventoried illustrations may enter a share card.
  return path && /^\/bpl\/portraits\/[a-z0-9-]+\.webp$/.test(path) && inventory[id]?.src === path ? path : null;
}

export function playerSummary(id: string, matches: ArchiveMatch[]) {
  const appearances = matches.filter(m => m.battles.some(b => b.players.some(side => side.includes(id))));
  let wins = 0, draws = 0, losses = 0, firsts = 0, duoSongs = 0;
  for (const match of appearances) {
    // ZERO has battle-level points, not song-level EX SCORE records.
    if (match.season === 0) continue;
    for (const battle of match.battles) {
      const side = battle.players.findIndex(lineup => lineup.includes(id));
      if (side < 0) continue;
      for (const song of battle.songs) {
        if (battle.type === 'single') {
          const own = song.scores[side], other = song.scores[1 - side];
          if (typeof own !== 'number' || !Number.isFinite(own) || typeof other !== 'number' || !Number.isFinite(other)) continue;
          if (own > other) wins++;
          else if (own < other) losses++;
          else draws++;
        } else if (battle.type === 'tag') {
          const result = song.individual.find(record => record.player === id);
          if (!result || typeof result.score !== 'number' || !Number.isFinite(result.score)) continue;
          duoSongs++;
          if (result.rank === 1) firsts++;
        }
      }
    }
  }
  return { matches: appearances.length, wins, draws, losses, songs: wins + draws + losses, rate: winRate(wins, losses), firsts, duoSongs };
}

export function teamSummary(id: string, matches: ArchiveMatch[]) {
  const appearances = matches.filter(match => match.teams.includes(id));
  let wins = 0, draws = 0, losses = 0, titles = 0;
  for (const match of appearances) {
    const side = match.teams.indexOf(id), own = match.points[side], other = match.points[1 - side];
    if (own === undefined || other === undefined) continue;
    if (own > other) { wins++; if (match.stage === 'final') titles++; }
    else if (own < other) losses++;
    else draws++;
  }
  return { matches: appearances.length, wins, draws, losses, titles, rate: winRate(wins, losses) };
}

export function teamRoster(id: string, requested?: string | null) {
  const seasons = [...new Set(data.players.flatMap(player => player.history.filter(h => h.team === id).map(h => h.season)))].sort((a, b) => a - b);
  const latest = seasons.at(-1) ?? 0;
  const season = requested !== null && requested !== undefined && requested !== 'all' && seasons.includes(Number(requested)) ? Number(requested) : latest;
  const members = data.players.filter(player => player.history.some(h => h.team === id && h.season === season)).map(player => ({ id: player.id, name: player.name, portrait: portraitFor(player.id) }));
  return { season, latest, members };
}

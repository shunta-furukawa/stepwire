// Official published regular-stage standings, kept separate from tournament finish.
// Ranking order is transcribed, never inferred from combined-stage win counts.
/** @param {Array<[string, number, number, number, number]>} entries */
const rows = entries => entries.map(([team, value, wins, draws, losses]) => ({team, value, wins, draws, losses}));
export const seasonStandings = {
  0: {source:'https://p.eagate.573.jp/game/bpl/season2/ddr/zero/index.html',metric:'勝点',note:'3チームによるエキシビション。予選は各2試合。勝点は勝利3・引分1・敗北0。',groups:[{name:'ZERO 予選リーグ',rows:rows([['BLUE',6,2,0,0],['WHITE',3,1,0,1],['RED',0,0,0,2]])}]},
  2: {source:'https://p.eagate.573.jp/game/bpl/season2/ddr/ranking/index.html',metric:'勝点',note:'A・Bの2グループで各3試合。勝点は勝利3・引分1・敗北0。同勝点時の順序も公式順位表に準拠。',groups:[
    {name:'Aグループ',rows:rows([['silkhat',7,2,1,0],['gigo',6,2,0,1],['game_panic',3,1,0,2],['taitostation_tradz',1,0,1,2]])},
    {name:'Bグループ',rows:rows([['round1',6,2,0,1],['leisure_land',6,2,0,1],['apina_vrames',6,2,0,1],['supernova_tohoku',0,0,0,3]])},
  ]},
  4: {source:'https://p.eagate.573.jp/game/bpl/season4/ddr/ranking/index.html',metric:'勝点',note:'7チーム総当たり・各6試合。勝点は勝利3・引分1・敗北0。同勝点時の順序も公式順位表に準拠。',groups:[{name:'レギュラーステージ（全7チーム）',rows:rows([['round1',12,3,3,0],['taitostation_tradz',10,3,1,2],['game_panic',10,3,1,2],['silkhat',10,3,1,2],['gigo',10,3,1,2],['leisure_land',5,1,2,3],['apina_vrames',1,0,1,5]])}]},
  5: {source:'https://p.eagate.573.jp/game/bpl/season5/ranking/index.html#tab3',metric:'勝点',note:'7チーム・各4試合の変則リーグ。勝点は勝利3・引分1・敗北0。同勝点時の順序も公式順位表に準拠。',groups:[{name:'DDR レギュラーステージ（全7チーム）',rows:rows([['taitostation_tradz',12,4,0,0],['apina_vrames',7,2,1,1],['round1',6,2,0,2],['gigo',6,2,0,2],['game_panic',5,1,2,1],['silkhat',4,1,1,2],['leisure_land',0,0,0,4]])}]},
};

/** @param {string | number} season */
export function seasonTeamIds(data, season = 'all') {
  if (season === 'all') return Object.keys(data.teams);
  const n = Number(season);
  return Object.keys(data.teams).filter(id => data.players.some(p => p.history.some(h => h.season === n && h.team === id)) || data.matches.some(m => m.season === n && m.teams.includes(id)));
}

export function normalizeSeasonFilters(data, filters) {
  const season = ['all', '0', '2', '4', '5', '6'].includes(String(filters.season)) ? String(filters.season) : 'all';
  const team = filters.team === 'all' || seasonTeamIds(data, season).includes(filters.team) ? filters.team : 'all';
  const stage = filters.stage === 'all' || data.matches.some(m => (season === 'all' || m.season === Number(season)) && m.stage === filters.stage) ? filters.stage : 'all';
  return { season, team, stage };
}

export function tournamentFinishes(data, season) {
  const matches = data.matches.filter(m => m.season === Number(season));
  const final = matches.find(m => m.stage === 'final');
  if (!final || final.points[0] === final.points[1]) return {};
  const winner = final.points[0] > final.points[1] ? 0 : 1;
  const finishes = Object.fromEntries(seasonTeamIds(data, season).map(id => [id, 'レギュラー敗退']));
  for (const [stage, label] of [['quarter', 'ベスト8'], ['semi', 'ベスト4']]) {
    for (const match of matches.filter(m => m.stage === stage)) for (const id of match.teams) finishes[id] = label;
  }
  // Advancement is established by the next round's participants, including S4's
  // 9–9 semifinal: match-score ties must not invent the advancing team.
  finishes[final.teams[winner]] = '優勝';
  finishes[final.teams[1 - winner]] = '準優勝';
  return finishes;
}

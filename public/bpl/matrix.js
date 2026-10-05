// One aggregation implementation for the browser table and its share image.
export const matrixOptions = {
 matrixSeason: ['all','2','4','5'],
 matrixFormat: ['all','single','tag'],
 matrixCategory: ['all','CLASSIC','WHITE','GOLD','POPULAR','KONAMI指定'],
 matrixStyle: ['all','STANDARD','TRICKY'],
};
export function matrixFilters(input = {}) {
 return Object.fromEntries(Object.entries(matrixOptions).map(([key, values]) => [key, values.includes(input[key]) ? input[key] : 'all']));
}
export function matrixRows(matches, a, b, input = {}) {
 const f = matrixFilters(input), rows = [];
 if (a === b) return rows;
 for (const m of matches) {
  if (m.season === 0 || m.season >= 6 || (f.matrixSeason !== 'all' && String(m.season) !== f.matrixSeason)) continue;
  for (const battle of m.battles) {
   const side = battle.players.findIndex(ps => ps.includes(a));
   if (side < 0 || !battle.players[1-side]?.includes(b)) continue;
   if (f.matrixFormat !== 'all' && battle.type !== f.matrixFormat) continue;
   const tokens = (battle.theme || '').split(/\s+/);
   if (f.matrixCategory !== 'all' && !tokens.includes(f.matrixCategory)) continue;
   if (f.matrixStyle !== 'all' && !tokens.includes(f.matrixStyle)) continue;
   for (const song of battle.songs) {
    const scoreA = battle.type === 'tag' ? song.individual.find(p => p.player === a)?.score : song.scores[side];
    const scoreB = battle.type === 'tag' ? song.individual.find(p => p.player === b)?.score : song.scores[1-side];
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) continue;
    rows.push({matchId:m.id,season:m.season,date:m.date,theme:battle.theme,format:battle.type,song:song.name,scoreA,scoreB});
   }
  }
 }
 return rows;
}
export function matrixTally(rows) {
 const w=rows.filter(r=>r.scoreA>r.scoreB).length,d=rows.filter(r=>r.scoreA===r.scoreB).length;
 return {w,d,l:rows.length-w-d,n:rows.length,rate:rows.length?Math.round(w/rows.length*100):null};
}
/** @returns {{left: {id:string,name:string}[], right: {id:string,name:string}[], filters: Record<string,string>, cells: {w:number,d:number,l:number,n:number,rate:number|null}[][]}} */
export function matrixModel(data, a, b, input = {}) {
 const roster = team => data.players.filter(p=>p.history.some(h=>h.season===6&&h.team===team)).map(p=>({id:p.id,name:p.name}));
 const left=roster(a),right=roster(b),filters=matrixFilters(input);
 return {left,right,filters,cells:left.map(p=>right.map(q=>matrixTally(matrixRows(data.matches,p.id,q.id,filters))))};
}

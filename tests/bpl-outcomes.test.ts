import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import * as jackets from '../public/bpl/jackets.js';
import palettes from '../public/bpl/jacket-colors.json';
import data from '../public/bpl/data.json';
import brand from '../public/bpl/brand.json';
import * as routing from '../public/bpl/routing.js';
const script = readFileSync('public/bpl/app.js', 'utf8');
const css = ['style.css', 'theme.css'].map(name => readFileSync('public/bpl/' + name, 'utf8')).join('\n');
const bootStart = script.indexOf('Promise.all([...[');
const bootEnd = script.indexOf('// Share URLs carry', bootStart);

// Run the shipped card, detail and versus renderers, with only DOM operations
// adapted. Palette markup is never substituted with a test renderer.
function renderHarness(colors: unknown = palettes, module: unknown = jackets) {
  class Node {
    innerHTML = ''; textContent = ''; value = ''; hidden = false; open = false; scrollTop = 0;
    className = ''; content = ''; style = {}; dataset = {};
    addEventListener() {} querySelector() { return null; } after() {}
    showModal() { this.open = true; }
  }
  const nodes = new Map<string, Node>();
  function get(selector: string) {
    if (!nodes.has(selector)) nodes.set(selector, new Node());
    return nodes.get(selector)!;
  }
  const ctx = vm.createContext({
    URL, URLSearchParams,
    document: { querySelector: get, getElementById: (id: string) => get('#' + id), querySelectorAll: () => [], createElement: () => new Node(), addEventListener() {}, body: { style: {} } },
    window: { addEventListener() {} },
    allArchiveMatches: data.matches, s6SessionPrefs: { hideResults: true },
    inputData: structuredClone(data), inputBrand: structuredClone(brand), inputColors: colors, inputJackets: module, inputFilters: routing.defaultFilters,
  });
  vm.runInContext(readFileSync('public/bpl/seasons.js', 'utf8') + '\n' + script.slice(0, bootStart) + script.slice(bootEnd), ctx);
  vm.runInContext('D=inputData;B=inputBrand;Jackets=inputJackets;JacketColors=inputColors;Object.assign(state,inputFilters);for(const [id,t] of Object.entries(B.teams))Object.assign(D.teams[id],t)', ctx);
  return { run: (code: string) => vm.runInContext(code, ctx), get };
}

describe('BPL result labels and historical affiliation', () => {
  it('compares both sides, draws and zero without inventing missing results', () => {
    const h = renderHarness();
    for (const [a,b,expected] of [[100,99,'w'],[99,100,'l'],[100,100,'d'],[0,10,'l'],[10,0,'w'],[0,0,'d'],[null,0,'u'],[0,null,'u']]) {
      expect(h.run(`scoreOutcome(${JSON.stringify(a)},${JSON.stringify(b)})`)).toBe(expected);
    }
    for (const value of ['undefined', 'NaN', 'Infinity', '-1', '"0"']) expect(h.run(`scoreOutcome(${value},0)`)).toBe('u');
    expect(h.run('outcomeBadge(null,0)')).not.toMatch(/WIN|LOSE|DRAW/);
    expect(h.run('scoreDifference(1510,1513)')).toBe('-3');
    expect(h.run('scoreDifference(1513,1510)')).toBe('+3');
    expect(h.run('scoreDifference(0,0)')).toBe('0');
    expect(h.run('scoreDifference(null,0)')).toBe('—');
    expect(h.run('resultNumber(Infinity)')).toBe('—');
  });
  it('keeps the real StrayedCatz win and loss beside its two scores', () => {
    const h = renderHarness();
    h.run(`renderMatch('s4-semi_01')`);
    const html = h.get('#dialog-content').innerHTML;
    expect(html).toContain('data-team="round1"');
    expect(html).toContain('data-team="silkhat"');
    expect(html).toContain('lineup-team">ROUND1');
    expect(html).toMatch(/score-result w" data-side="0"[^]*?>WIN<\/span><b>1,384<\/b>/);
    expect(html).toMatch(/score-result l" data-side="1"[^]*?>LOSE<\/span><b>1,372<\/b>/);
  });
  it('uses match teams even after a player transfers and for ZERO teams', () => {
    const h = renderHarness();
    const transferred = data.players.find(p => p.id === 'HO4-KETI')!;
    expect(transferred.history.at(-1)!.team).toBe('round1');
    const old = data.matches.find(m => m.teams.includes('game_panic') && m.battles.some(b => b.players.flat().includes('HO4-KETI')))!;
    h.run(`renderMatch(${JSON.stringify(old.id)})`);
    const html = h.get('#dialog-content').innerHTML;
    expect(html).toMatch(/data-team="game_panic"[^]*?lineup-team">GAME PANIC[^]*?href="#player\/HO4-KETI"/);
    const zero = data.matches.find(m => m.season === 0)!;
    h.run(`renderMatch(${JSON.stringify(zero.id)})`);
    for (const team of zero.teams) expect(h.get('#dialog-content').innerHTML).toContain(`data-team="${team}"`);
    expect(h.get('#dialog-content').innerHTML).not.toContain('result-badge');
  });
  it('labels Duo pair draws using official points despite unequal individual scores', () => {
    const h = renderHarness();
    h.run(`state.a='O4MA.';state.b='KANAME';versusPage()`);
    const row = h.run(`headToHead('O4MA.','KANAME').rows.find(r=>r.song.name==='恋閃繚乱')`);
    expect(row).toMatchObject({scoreA:1510,scoreB:1513,pointA:3,pointB:3});
    const left = h.run(`duelScoreCell(headToHead('O4MA.','KANAME').rows.find(r=>r.song.name==='恋閃繚乱'),0)`);
    const right = h.run(`duelScoreCell(headToHead('O4MA.','KANAME').rows.find(r=>r.song.name==='恋閃繚乱'),1)`);
    expect(left).toMatch(/score-result l[^]*?個人EX[^]*?1,510/);
    expect(right).toMatch(/score-result w[^]*?個人EX[^]*?1,513/);
    for (const cell of [left,right]) { expect(cell).toContain('ペア結果'); expect(cell).toContain('>DRAW<'); expect(cell).not.toMatch(/>WIN<|>LOSE</); }
    const battle = row.b;
    expect(h.run(`matchSongScore(${JSON.stringify(battle)},${JSON.stringify(row.song)})`).match(/>DRAW</g)).toHaveLength(2);
  });
  it('reverses individual results with the selected player perspective, not home side', () => {
    const h = renderHarness();
    const code = `(a,b)=>headToHead(a,b).rows.find(r=>r.song.name==='Throw Out')`;
    const first = h.run(`(${code})('O4MA.','KANAME')`), reverse = h.run(`(${code})('KANAME','O4MA.')`);
    expect([first.scoreA,first.scoreB]).toEqual([reverse.scoreB,reverse.scoreA]);
    expect(h.run(`duelScoreCell((${code})('O4MA.','KANAME'),0)`)).toContain('>LOSE<');
    expect(h.run(`duelScoreCell((${code})('KANAME','O4MA.'),0)`)).toContain('>WIN<');
    const original = h.run(`duelTally(headToHead('O4MA.','KANAME').rows)`);
    const reversed = h.run(`duelTally(headToHead('KANAME','O4MA.').rows)`);
    expect([original.w,original.d,original.l]).toEqual([reversed.l,reversed.d,reversed.w]);
  });
  it('keeps unknown future song scores neutral and the existing palette semantics', () => {
    const h = renderHarness();
    for (const type of ['single','tag']) {
      const html = h.run(`matchSongScore({type:'${type}'},{scores:[null,null],points:[null,null]})`);
      expect(html.match(/score-result u/g)).toHaveLength(2);
      expect(html).not.toMatch(/>WIN<|>LOSE<|>DRAW</);
    }
    for (const [result,color] of [['w','accent'],['l','loss'],['d','muted']]) {
      expect(css).toContain(`.outcome.${result}{background:`);
      expect(css).toContain(`.score-result.${result}`);
      expect(css).toContain(`color:var(--${color})`);
    }
  });
});


describe('match card round points', () => {
  it('sums all 166 rounds once and reconciles every match with its separate advantage', () => {
    const h=renderHarness();
    for(const match of data.matches){
      const totals=[0,0];
      for(const battle of match.battles){
        const points=h.run(`roundPoints(${JSON.stringify(battle)})`) as number[];
        for(const side of [0,1])totals[side]=totals[side]!+points[side]!;
      }
      expect(totals.map((total,side)=>total+match.adjustment[side]!)).toEqual(match.points);
      const card=h.run(`matchCard(${JSON.stringify(match)})`) as string;
      expect((card.match(/class="round-point"/g)||[])).toHaveLength(match.battles.length*2);
      expect(card).toContain(`aria-describedby="round-summary-${match.id}"`);
      expect(card).toContain(`id="round-summary-${match.id}" hidden`);
      expect(card).toContain('第1ラウンド：');
      expect(card).toContain('ラウンド獲得点');expect(card).toContain('（pt）');expect(card).not.toContain('EX SCORE');
      expect(card.includes('class="match-adjustment"')).toBe(match.adjustment.some(Boolean));
    }
  });
  it('keeps ZERO, singles, Duo ties, duplicate titles and weighted rounds source-driven', () => {
    const h=renderHarness();
    for(const [id,number,expected] of [
      ['zero-0',3,[4,9]],['s2-regular-6',1,[1,1]],['s2-regular-12',1,[2,1]],
      ['s5-regular-11',3,[4,11]],['s2-semi-18',5,[10,10]],['s5-final-1',5,[10,3]],['s4-regular_01',1,[6,6]],
    ] as const){
      const battle=data.matches.find(match=>match.id===id)!.battles.find(battle=>battle.number===number)!;
      expect(h.run(`roundPoints(${JSON.stringify(battle)})`)).toEqual(expected);
    }
    expect(h.run(`roundPoints({points:[2,0],songs:[{points:[100,100]}]})`)).toEqual([2,0]);
    expect(h.run(`matchCard(D.matches.find(m=>m.id==='s2-quarter-2'))`)).toContain('SILK HAT +2 pt');
  });
  it('preserves genuine zero and keeps incomplete or invalid sides unknown', () => {
    const h=renderHarness();
    for(const input of ['{}','{songs:[]}','{points:[null,null]}','{songs:[{}]}'])expect(h.run(`roundPoints(${input})`)).toEqual([null,null]);
    expect(h.run(`roundPoints({points:[0,0]})`)).toEqual([0,0]);
    expect(h.run(`roundPoints({songs:[{points:[0,0]}]})`)).toEqual([0,0]);
    for(const invalid of ['null','undefined','NaN','Infinity','-1','"0"']){
      expect(h.run(`roundPoints({points:[${invalid},2],songs:[{points:[1,1]}]})`)).toEqual([null,2]);
      expect(h.run(`roundPoints({songs:[{points:[1,0]},{points:[${invalid},2]}]})`)).toEqual([null,2]);
    }
    const unknown=h.run(`matchRoundPoints({teams:['WHITE','RED'],season:0},{number:1,songs:[]})`) as string;
    expect((unknown.match(/>—<\/span>/g)||[])).toHaveLength(2);expect(unknown).toContain('未確認');expect(unknown).not.toMatch(/WIN|LOSE|DRAW/);
  });
  it('pairs each point column with the historical match team, not the latest player affiliation', () => {
    const h=renderHarness();
    const match=data.matches.find(m=>m.teams.includes('game_panic')&&m.battles.some(b=>b.players.flat().includes('HO4-KETI')))!;
    const card=h.run(`matchCard(${JSON.stringify(match)})`) as string;
    const headers=[...card.matchAll(/class="round-team-label" data-team="([^"]+)" data-side="([01])"/g)];
    expect(headers.map(match=>match[1])).toEqual(match.teams);
    for(const [side,id] of match.teams.entries()){
      expect((card.match(new RegExp(`class="round-point" data-team="${id}" data-side="${side}"`,'g'))||[])).toHaveLength(match.battles.length);
    }
    expect(css).toMatch(/\.round-point\{[^}]*color:var\(--team-text\)/);
  });
});

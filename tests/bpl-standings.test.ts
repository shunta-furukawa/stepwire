import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import data from '../public/bpl/data.json';
import brand from '../public/bpl/brand.json';
import s6 from '../public/bpl/s6.json';
import * as standings from '../public/bpl/standings.js';
import { shareModel } from '../lib/bpl/share';

describe('official BPL regular-stage standings', () => {
  it('includes every historical participant exactly once and agrees with match-level W/D/L', () => {
    for (const n of [0, 2, 4, 5] as const) {
      const season = standings.seasonStandings[n];
      const rows = season.groups.flatMap(group => group.rows);
      expect(rows.map(row => row.team).sort()).toEqual(standings.seasonTeamIds(data, n).sort());
      expect(season.source).toMatch(/^https:\/\/p\.eagate\.573\.jp\/game\/bpl\//);
      expect(season.metric).toBe('勝点');
      for (const row of rows) {
        const matches = data.matches.filter(m => m.season === n && m.stage === 'regular' && m.teams.includes(row.team));
        const wins = matches.filter(m => { const side = m.teams.indexOf(row.team); return m.points[side]! > m.points[1 - side]!; }).length;
        const draws = matches.filter(m => m.points[0] === m.points[1]).length;
        expect([row.wins, row.draws, row.losses, row.value]).toEqual([wins, draws, matches.length - wins - draws, wins * 3 + draws]);
      }
    }
  });
  it('locks official group order and tied rankings rather than sorting arbitrary combined-stage totals', () => {
    expect(standings.seasonStandings[2].groups.map(g => g.rows.map(r => r.team))).toEqual([
      ['silkhat', 'gigo', 'game_panic', 'taitostation_tradz'],
      ['round1', 'leisure_land', 'apina_vrames', 'supernova_tohoku'],
    ]);
    expect(standings.seasonStandings[4].groups[0]!.rows.map(r => r.team)).toEqual(['round1', 'taitostation_tradz', 'game_panic', 'silkhat', 'gigo', 'leisure_land', 'apina_vrames']);
    expect(standings.seasonStandings[5].groups[0]!.rows.map(r => r.team)).toEqual(['taitostation_tradz', 'apina_vrames', 'round1', 'gigo', 'game_panic', 'silkhat', 'leisure_land']);
    expect(standings.seasonStandings[0].groups[0]!.rows.map(r => r.team)).toEqual(['BLUE', 'WHITE', 'RED']);
  });
  it('labels tournament finishes without inventing a total final order, including tied S4 semifinal', () => {
    expect(standings.tournamentFinishes(data, 2)).toEqual({apina_vrames:'ベスト8', gigo:'ベスト4', game_panic:'ベスト4', silkhat:'準優勝', supernova_tohoku:'ベスト8', taitostation_tradz:'ベスト8', round1:'優勝', leisure_land:'ベスト8'});
    expect(standings.tournamentFinishes(data, 4)).toMatchObject({taitostation_tradz:'優勝', silkhat:'準優勝', round1:'ベスト4', game_panic:'ベスト4', gigo:'レギュラー敗退'});
    expect(standings.tournamentFinishes(data, 5)).toMatchObject({taitostation_tradz:'優勝', round1:'準優勝', gigo:'ベスト4', apina_vrames:'ベスト4'});
    expect(standings.tournamentFinishes(data, 0)).toMatchObject({WHITE:'優勝', BLUE:'準優勝'});
    expect(standings.tournamentFinishes(data, 6)).toEqual({});
  });
  it('uses historical participation and recovers old incompatible shared filters', () => {
    for (const n of ['0','2','4','5','6']) expect(standings.seasonTeamIds(data, n)).toHaveLength(n === '0' ? 3 : n === '2' ? 8 : 7);
    expect(standings.normalizeSeasonFilters(data, {season:'4',team:'supernova_tohoku',stage:'quarter'})).toEqual({season:'4',team:'all',stage:'all'});
    expect(standings.normalizeSeasonFilters(data, {season:'2',team:'supernova_tohoku',stage:'quarter'})).toEqual({season:'2',team:'supernova_tohoku',stage:'quarter'});
    expect(standings.normalizeSeasonFilters(data, {season:'5',team:'WHITE',stage:'final'})).toEqual({season:'5',team:'all',stage:'final'});
    expect(standings.normalizeSeasonFilters(data, {season:'all',team:'WHITE',stage:'final'}).team).toBe('WHITE');
    expect(standings.normalizeSeasonFilters(data, {season:'unknown',team:'unknown',stage:'unknown'})).toEqual({season:'all',team:'all',stage:'all'});
    const model = shareModel(new URLSearchParams('view=seasons&season=4&team=supernova_tohoku&stage=quarter'));
    expect(model.params.get('team')).toBe('all');expect(model.params.get('stage')).toBe('all');expect(model.metric).toBe('24試合');
    expect(model.detail).toContain('全チーム');
  });
});

function renderer(season = '4', selected = 'all') {
  const teams = Object.fromEntries(Object.entries(data.teams).map(([id,t]) => [id,{...t,...(brand.teams as Record<string, object>)[id]}]));
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c));
  const context = vm.createContext({Standings:standings,D:{...data,teams},S6:s6,state:{season,team:selected},esc,seasonLabel:(n:unknown)=>Number(n)===0?'ZERO':`S${n}`,team:(id:string)=>teams[id],teamName:(id:string,n:number)=>Number(n)===6?(teams[id] as {currentName?:string}).currentName||teams[id]!.name:teams[id]!.name,teamVars:()=>'',logo:(id:string)=>`<span class="team-logo">${esc(id)}</span>`,external:(url:string,text:string)=>`<a href="${esc(url)}">${text}</a>`,s6Teams:()=>standings.seasonTeamIds(data,6)});
  vm.runInContext(readFileSync('public/bpl/seasons.js','utf8'),context);
  return {render:(code:string)=>vm.runInContext(code,context) as string};
}

describe('season outcome markup', () => {
  it('shows regular rank and finish separately above card filters without filtered standings', () => {
    const html=renderer().render('seasonResults(4)');
    expect((html.match(/class="standings-row"/g)||[])).toHaveLength(7);
    expect(html).toContain('レギュラーステージ順位');expect(html).toContain('最終成績');expect(html).toContain('勝点');expect(html).not.toContain('EX SCORE');
    expect(renderer('4','round1').render('seasonResults(4)')).toBe(html);
    const app=readFileSync('public/bpl/app.js','utf8');
    expect(app.indexOf('${seasonResults(state.season)}')).toBeLessThan(app.indexOf('<section id="season-matches">'));
  });
  it('shows S6 as unranked and ZERO as exhibition without a false league-wide ranking', () => {
    const upcoming=renderer().render('seasonResults(6)');
    expect(upcoming).toContain('開幕前');expect(upcoming).toContain('順位未確定');expect(upcoming).not.toContain('standings-table');
    expect((upcoming.match(/href="#team\//g)||[])).toHaveLength(7);
    expect(renderer().render('seasonResults(0)')).toContain('エキシビション');
    expect((renderer().render('seasonResults(2)').match(/<table/g)||[])).toHaveLength(2);
  });
  it('renders only the selected season participants plus all teams, with no hidden or disabled remnants', () => {
    for (const season of ['0','2','4','5','6','all']) {
      const html=renderer(season).render('seasonTeamFilters()');
      const ids=[...html.matchAll(/data-team-filter="([^"]+)"/g)].map(match=>match[1]);
      expect(ids).toEqual(['all',...standings.seasonTeamIds(data,season)]);
      expect(html).not.toMatch(/disabled|aria-hidden|不参加/);
      expect(html).toMatch(/data-team-filter="all" aria-pressed="true">/);
    }
    expect(renderer('2','supernova_tohoku').render('seasonTeamFilters()')).toMatch(/data-team-filter="supernova_tohoku" aria-pressed="true"/);
    expect(renderer('4').render('seasonTeamFilters()')).not.toContain('supernova_tohoku');
    expect(renderer('0').render('seasonTeamFilters()')).not.toContain('round1');
  });
});

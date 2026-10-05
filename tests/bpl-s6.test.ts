import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe,it,expect } from 'vitest';
import data from '../public/bpl/data.json';
import s6 from '../public/bpl/s6.json';
import { shareModel } from '../lib/bpl/share';
function logic(search='') {
 const D=structuredClone(data);
 const ctx=vm.createContext({D,URLSearchParams,location:{search},document:{documentElement:{dataset:{}}},localStorage:{getItem:()=>null,setItem:()=>{}}});
 vm.runInContext(readFileSync('public/bpl/s6.js','utf8')+';this.api={initS6,s6Teams,s6Roster,s6Movement,s6PreviewSummary,applyS6Visibility};',ctx);
 ctx.api.initS6(s6);return {D,ctx,api:ctx.api};
}
describe('S6 observation guide',()=>{
 it('contains 7 four-player rosters',()=>{const {api}=logic();expect(api.s6Teams()).toHaveLength(7);for(const id of api.s6Teams())expect(api.s6Roster(id)).toHaveLength(4)});
 it('derives transfers from S5 rather than the last historical affiliation',()=>{const {api}=logic();for(const p of data.players.filter(p=>p.history.some(h=>h.season===6))){const old=p.history.find(h=>h.season===5),now=p.history.find(h=>h.season===6)!;expect(api.s6Movement(p).kind).toBe(old?(old.team===now.team?'継続':'移籍'):p.history.some(h=>h.season<5)?'復帰':'新加入')}});
 it('reverses team comparison symmetrically and excludes S6',()=>{const {api}=logic();const a=api.s6PreviewSummary('round1','gigo'),b=api.s6PreviewSummary('gigo','round1');expect(a.w).toBe(b.l);expect(a.l).toBe(b.w);expect(a.d).toBe(b.d);expect(a.ms.every((m:{season:number})=>m.season<6)).toBe(true)});
 it('defaults to hiding S6 and omits it from all aggregate data',()=>{const {ctx,D,api}=logic();const fixture={...structuredClone(data.matches[0]!),id:'s6-test',season:6};D.matches.push(fixture);api.initS6(s6);expect(D.matches.some(m=>m.season===6)).toBe(false);vm.runInContext('s6SessionPrefs.hideResults=false;applyS6Visibility()',ctx);expect(D.matches.some(m=>m.season===6)).toBe(true)});
 it('does not leak scores via shared metadata when hidden',()=>{data.matches.push({...data.matches[0]!,id:'s6-test',season:6,points:[18,2]});try{const hidden=shareModel(new URLSearchParams({view:'match',id:'s6-test'}));expect(hidden.score).toBe('結果は非表示');expect(JSON.stringify(hidden)).not.toContain('18 — 2');expect(shareModel(new URLSearchParams({view:'match',id:'s6-test',hideResults:'0'})).score).toBe('18 — 2')}finally{data.matches.pop()}});
 it('has no invented schedule cards',()=>{expect(s6.fixtures).toHaveLength(0);expect(s6.launchScope).toContain('全体')});
});

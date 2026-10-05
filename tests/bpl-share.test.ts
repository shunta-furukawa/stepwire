import { describe, it, expect } from 'vitest';
import { shareModel, escapeHtml } from '../lib/bpl/share';
import data from '../public/bpl/data.json';

describe('BPL shared cards',()=>{
 it('validates every match and keeps official points',()=>{for(const m of data.matches){const c=shareModel(new URLSearchParams({view:'match',id:m.id}));expect(c.score).toBe(m.points.join(' — '));expect(c.metric).toContain(m.date)}});
 it('preserves season zero and stage/team filters',()=>{const c=shareModel(new URLSearchParams({view:'seasons',season:'0'}));expect(c.title).toContain('ZERO');expect(c.metric).toBe('4試合');expect(shareModel(new URLSearchParams({view:'seasons',season:'5',stage:'final'})).metric).toBe('1試合')});
 it('keeps punctuation and exact duo partners in URLs',()=>{const p=new URLSearchParams({view:'versus',a:'O4MA.',b:'HIBIKI',vsSeason:'4',vsFormat:'tag',partnerA:'all',partnerB:'all'});const c=shareModel(p);expect(c.detail).toContain('DUO × DUO');expect(c.params.get('a')).toBe('O4MA.');expect(c.params.get('vsSeason')).toBe('4')});
 it('generates every player and team',()=>{for(const p of data.players)expect(shareModel(new URLSearchParams({view:'player',id:p.id})).title).toBe(p.name);for(const id of Object.keys(data.teams))expect(shareModel(new URLSearchParams({view:'team',id})).title).toBeTruthy()});
 it('rejects invalid input and escapes metadata',()=>{for(const q of ['view=match&id=missing','view=player&id=%3Cscript%3E','view=versus&a=HIBIKI&b=HIBIKI','season=3','view=team&id=__proto__'])expect(()=>shareModel(new URLSearchParams(q))).toThrow(RangeError);expect(escapeHtml('<script>"&')).toBe('&lt;script&gt;&quot;&amp;')});
 it('supports S6 previews without publishing predicted fixtures',()=>{expect(shareModel(new URLSearchParams()).title).toBe('S6 観戦ガイド');expect(shareModel(new URLSearchParams({view:'preview',previewA:'round1',previewB:'gigo'})).detail).toContain('未発表');expect(()=>shareModel(new URLSearchParams({view:'preview',previewA:'round1',previewB:'round1'}))).toThrow(RangeError)});
 it('supports all real player sort controls',()=>{for(const sort of ['matches','wins','firsts','name'])expect(shareModel(new URLSearchParams({view:'players',sort})).params.get('sort')).toBe(sort)});
});

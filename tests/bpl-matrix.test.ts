import {describe,it,expect} from 'vitest';
import data from '../public/bpl/data.json';
import {matrixRows,matrixTally,matrixModel,matrixTone} from '../public/bpl/matrix.js';
import {shareModel} from '../lib/bpl/share';
describe('player matrix',()=>{
 it('uses opposing individual EX scores in Duo, never pair points',()=>{
  const rows=matrixRows(data.matches,'THOR','KANAME',{matrixSeason:'2',matrixFormat:'tag'});
  const song=rows.find(r=>r.song==='ALPACORE');expect(song).toMatchObject({scoreA:1892,scoreB:1903,theme:'GOLD STANDARD'});
  expect(matrixTally([song!])).toMatchObject({w:0,l:1,rate:0});
 });
 it('excludes teammates and S6, reverses scores symmetrically',()=>{
  const m=data.matches.find(m=>m.id==='s2-regular-6')!;
  expect(matrixRows([m],'THOR','MENN',{matrixFormat:'tag'})).toHaveLength(0);
  expect(matrixRows([{...m,season:6}],'THOR','KANAME')).toHaveLength(0);
  const a=matrixTally(matrixRows(data.matches,'THOR','KANAME')),b=matrixTally(matrixRows(data.matches,'KANAME','THOR'));
  expect(a.w).toBe(b.l);expect(a.d).toBe(b.d);expect(a.n).toBe(b.n);
 });
 it('separates zero records, draws, and a true zero win rate',()=>{
  expect(matrixTally([]).rate).toBeNull();
  expect(matrixTally([{scoreA:1,scoreB:1},{scoreA:1,scoreB:2}])).toMatchObject({w:0,d:1,l:1,rate:0,n:2});
  expect(matrixTally([{scoreA:2,scoreB:1},{scoreA:1,scoreB:1}]).rate).toBe(100);
 });
 it('leaves draws out of the denominator and uses neutral colors at 50 percent',()=>{
  expect(matrixTally([{scoreA:1,scoreB:1}]).rate).toBeNull();
  const even=matrixTally([{scoreA:2,scoreB:1},{scoreA:1,scoreB:2},{scoreA:1,scoreB:1}]);
  expect(even.rate).toBe(50);expect(even.d).toBe(1);
  expect(matrixTone(50)).toEqual({color:'#ecece7',background:'#222225'});
  expect(matrixTone(100).color).toBe('#c2e975');expect(matrixTone(0).color).toBe('#ffaaa7');
  expect(matrixTone(null).color).toBe('#96969c');
 });
 it('filters the official battle category and style together',()=>{
  const rows=matrixRows(data.matches,'THOR','KANAME',{matrixCategory:'GOLD',matrixStyle:'STANDARD'});
  expect(rows.length).toBeGreaterThan(0);expect(rows.every(r=>r.theme==='GOLD STANDARD')).toBe(true);
  expect(matrixRows(data.matches,'THOR','KANAME',{matrixCategory:'POPULAR',matrixStyle:'TRICKY'})).toHaveLength(0);
 });
 it('shares the exact filtered four by four matrix and rejects invalid filters',()=>{
  const q=new URLSearchParams({view:'matrix',previewA:'round1',previewB:'gigo',matrixCategory:'GOLD',matrixFormat:'tag'}),model=shareModel(q);
  expect(model.matrix).toEqual(matrixModel(data,'round1','gigo',Object.fromEntries(q)));
  expect(model.matrix!.cells).toHaveLength(4);expect(model.matrix!.cells.every(r=>r.length===4)).toBe(true);
  expect(model.params.get('matrixCategory')).toBe('GOLD');
  q.set('matrixStyle','INVENTED');expect(()=>shareModel(q)).toThrow(RangeError);
 });
});

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import * as routing from '../public/bpl/routing.js';
import * as matrix from '../public/bpl/matrix.js';
import * as jackets from '../public/bpl/jackets.js';
import * as standings from '../public/bpl/standings.js';
import jacketColors from '../public/bpl/jacket-colors.json';
import data from '../public/bpl/data.json';
import brand from '../public/bpl/brand.json';
import s6 from '../public/bpl/s6.json';

const url = (path: string) => new URL(path, 'https://stepwire.test');
const app = readFileSync('public/bpl/app.js', 'utf8');
const punctuationPlayers = ['O4MA.', 'ZERO.', 'A.N.C.B.', 'MOO-G.56', '$RYO$', 'UN-RE'];
const trimPlaintextPunctuation = (value: string) => value.replace(/[.,!?;:)\]}"'。、！？）］｝」』】]+$/u, '');

function expectSafePlayerLink(value: string, id: string) {
  expect(value).toMatch(/&linkVersion=1$/);
  expect(trimPlaintextPunctuation(value)).toBe(value);
  expect(trimPlaintextPunctuation(value + '.')).toBe(value);
  expect(url(value).searchParams.get('id')).toBe(id);
  if (id.includes('.')) expect(value).toContain('%2E');
}

describe('BPL URL state', () => {
  it('round trips every filter without leaking state from the previous page', () => {
    const filters = {...routing.defaultFilters, season:'0', team:'WHITE', stage:'final', query:'O4MA. / &', playerSeason:'6', playerTeam:'round1', sort:'name', a:'O4MA.', b:'HIBIKI', vsSeason:'4', vsFormat:'tag', partnerA:'KANAME', partnerB:'all', previewA:'round1', previewB:'gigo', matrixSeason:'5', matrixFormat:'single', matrixCategory:'GOLD', matrixStyle:'TRICKY', rosterSeason:'2'};
    for(const view of ['seasons','players','versus','preview','matrix','team','player','match']) {
      const route = {view, id:view==='team'?'round1':'O4MA.', filters, hideResults:false};
      const params = routing.routeParams(route);
      const restored = routing.parseRoute(url(routing.routePath(route)));
      expect(restored.view).toBe(view);
      expect(restored.hideResults).toBe(false);
      for(const key of Object.keys(filters) as Array<keyof typeof filters>) expect(restored.filters[key]).toBe(params.has(key)?filters[key]:routing.defaultFilters[key]);
      expect(routing.routePath(route)).not.toContain('#');
      if(['team','player'].includes(view))expect(params.get('summaryVersion')).toBe('1');
    }
  });

  it('accepts punctuation, old query+hash links, S6 rosters, and direct match links', () => {
    expect(routing.parseRoute(url('/bpl#player/O4MA.')).id).toBe('O4MA.');
    expect(routing.parseRoute(url('/bpl#player/A%2FB%26C')).id).toBe('A/B&C');
    expect(routing.parseRoute(url('/bpl#players/s6')).filters.playerSeason).toBe('6');
    const legacy = routing.parseRoute(url('/bpl/s?view=versus&vsFormat=tag&vsSeason=4&partnerA=KANAME#versus/O4MA./HIBIKI'));
    expect(legacy.filters).toMatchObject({a:'O4MA.',b:'HIBIKI',vsFormat:'tag',vsSeason:'4',partnerA:'KANAME'});
    expect(routing.parseRoute(url('/bpl/s?view=match&id=zero-final#seasons')).view).toBe('match');
    expect(routing.parseRoute(url('/bpl/s?view=match&id=zero-final#player/HIBIKI'),true,true).view).toBe('player');
    expect(()=>routing.parseRoute(url('/bpl#player/%broken'))).not.toThrow();
  });

  it('round trips all player IDs through distinct punctuation-safe address-bar URLs', () => {
    const paths = data.players.map(({id}) => {
      const path = routing.routePath({view:'player', id, filters:{...routing.defaultFilters}, hideResults:true});
      expectSafePlayerLink(path, id);
      expect(routing.parseRoute(url(trimPlaintextPunctuation(path))).id).toBe(id);
      expect(routing.parseRoute(url('/bpl/s?view=player&id=' + id)).id).toBe(id);
      expect(routing.parseRoute(url('/bpl#player/' + encodeURIComponent(id))).id).toBe(id);
      return path;
    });
    expect(new Set(paths).size).toBe(data.players.length);
  });
});

// Execute the shipped renderers against a small DOM/history adapter. The separate
// Playwright suite covers real browser events, focus, dialog behavior and layout.
function harness(path: string, future = false) {
  type Listener = (event: Record<string, unknown>) => void;
  const nodes = new Map<string, ElementStub>(), pending: Array<() => void> = [];
  let mainWrites = 0, copied = '';
  class ElementStub {
    content = ''; textContent = ''; value = ''; hidden = false; open = false;
    id = ''; className = ''; hash = ''; target = ''; scrollTop = 0; scrollLeft = 0; scrollWidth = 0; clientWidth = 0;
    dataset: Record<string,string> = {}; style: Record<string,string> = {}; parentElement = {classList:{add(){}},style:{cssText:''}};
    classList = {toggle(){},add(){}};
    listeners = new Map<string,Listener[]>();
    onclick?: Listener; onchange?: Listener; oninput?: Listener;
    set innerHTML(value: string) {
      this.content=value;if(this===nodes.get('main'))mainWrites++;
      for(const match of value.matchAll(/<select[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
        const select = get('#'+match[1]);
        const options = [...(match[2] ?? '').matchAll(/<option value="([^"]*)"([^>]*)>/g)];
        select.value=(options.find(option=>option[2]?.includes('selected'))||options[0])?.[1]||'';
      }
    }
    get innerHTML(){return this.content}
    addEventListener(type:string,fn:Listener){this.listeners.set(type,[...(this.listeners.get(type)||[]),fn])}
    dispatch(type:string,event:Record<string,unknown>={}){for(const fn of this.listeners.get(type)||[])fn(event)}
    setAttribute(){} removeAttribute(){} focus(){} scrollIntoView(){} after(){} append(){} select(){}
    querySelector(){return null} querySelectorAll(){return []}
    showModal(){this.open=true}
    close(){this.open=false;pending.push(()=>this.dispatch('close'))}
    getBoundingClientRect(){return {left:100,right:500,top:100,bottom:500}}
  }
  function get(selector:string){let node=nodes.get(selector);if(!node){node=new ElementStub();nodes.set(selector,node)}return node}
  const nav = ['s6','seasons','teams','players','versus','about'].map(view=>{const node=new ElementStub();node.hash='#'+view;node.dataset.view=view;return node});
  const documentEvents = new Map<string,Listener[]>(), windowEvents = new Map<string,Listener[]>();
  let location = url(path);
  const entries: Array<{url:URL;state:unknown}> = [{url:location,state:null}];let index=0;
  function emit(type:string){for(const fn of windowEvents.get(type)||[])fn({type})}
  function go(delta:number){if(index+delta<0||index+delta>=entries.length)return;const oldHash=location.hash;index+=delta;location=entries[index]!.url;emit('popstate');if(oldHash!==location.hash)emit('hashchange')}
  const history = {
    get state(){return entries[index]!.state},get length(){return entries.length},
    pushState(state:unknown,_title:string,path:string){location=url(path);entries.splice(index+1);entries.push({url:location,state:structuredClone(state)});index++},
    replaceState(state:unknown,_title:string,path:string){location=url(path);entries[index]={url:location,state:structuredClone(state)}},
    back(){go(-1)},forward(){go(1)},
  };
  const cloned = structuredClone(data);
  if(future)cloned.matches.push({...structuredClone(cloned.matches[0]!),id:'s6-future',season:6,points:[99,1]});
  const ctx = vm.createContext({URL,URLSearchParams,structuredClone,setTimeout,clearTimeout,
    get location(){return location},history,
    document:{querySelector:get,querySelectorAll:(selector:string)=>selector==='nav a'?nav:[],getElementById:(id:string)=>get('#'+id),createElement:()=>new ElementStub(),body:{style:{}},documentElement:{dataset:{}},addEventListener:(type:string,fn:Listener)=>documentEvents.set(type,[...(documentEvents.get(type)||[]),fn])},
    window:{addEventListener:(type:string,fn:Listener)=>windowEvents.set(type,[...(windowEvents.get(type)||[]),fn]),scrollTo(){}},
    localStorage:{getItem:()=>null,setItem(){}},navigator:{clipboard:{writeText:async(text:string)=>{copied=text}}},
    inputStandings:standings,inputData:cloned,inputBrand:structuredClone(brand),inputS6:s6,inputMatrix:matrix,inputRouting:routing,inputJackets:jackets,inputJacketColors:jacketColors,
  });
  const withoutBoot=app.slice(0,app.indexOf('Promise.all([...['))+app.slice(app.indexOf('// Share URLs carry'));
  vm.runInContext(readFileSync('public/bpl/seasons.js','utf8')+'\n'+readFileSync('public/bpl/s6.js','utf8')+'\n'+withoutBoot,ctx);
  vm.runInContext('Standings=inputStandings;D=inputData;B=inputBrand;Matrix=inputMatrix;Routing=inputRouting;Jackets=inputJackets;JacketColors=inputJacketColors;for(const [id,t] of Object.entries(B.teams))Object.assign(D.teams[id],t);initS6(inputS6);setupNavigation();initSharing();route()',ctx);
  const run = (code:string) => vm.runInContext(code,ctx);
  function flush(){while(pending.length)pending.shift()!()}
  function link(hash:string){const a=new ElementStub();a.hash=hash;const event={target:{closest:(selector:string)=>selector.startsWith('a[')?a:null},button:0,preventDefault(){},defaultPrevented:false};for(const fn of documentEvents.get('click')||[])fn(event);flush()}
  return {run,link,history,get,flush,emit,get location(){return location},get mainWrites(){return mainWrites},get copied(){return copied}};
}

describe('BPL history and shipped renderers', () => {
  it.each(punctuationPlayers)('copies and restores the exact player after plaintext autolinking: %s', async id => {
    const h = harness('/bpl/s?view=player&id=' + id);
    expectSafePlayerLink(h.location.href, id);
    expect(h.get('main').innerHTML).toContain(`<h1>${id}</h1>`);
    expect(h.run('document.title')).toBe(`${id} — BPL DDR RECORDS`);
    await h.run('copyShare(shareContext().url)');
    expectSafePlayerLink(h.copied, id);
    const image = h.run('shareContext().image') as string;
    expectSafePlayerLink(image, id);
    expect(url(image).pathname).toBe('/bpl/og');
    expect(url(image).searchParams.get('summaryVersion')).toBe('1');
    const fresh = harness(trimPlaintextPunctuation(h.copied + '.)'));
    expect(fresh.location.searchParams.get('id')).toBe(id);
    expect(fresh.get('main').innerHTML).toContain(`<h1>${id}</h1>`);
    expect(fresh.run('document.title')).toBe(`${id} — BPL DDR RECORDS`);
    expect(url(fresh.run('shareContext().image')).searchParams.get('id')).toBe(id);
  });

  it('restores repeated team/player navigation, entity sharing, roster scope and defaults', () => {
    const h=harness('/bpl/s?view=team&id=round1&rosterSeason=2');
    expect(h.get('#team-roster-season').value).toBe('2');
    expect(h.run('shareContext().params.get("id")')).toBe('round1');
    expect(h.run('shareContext().params.get("summaryVersion")')).toBe('1');
    h.get('meta[name="bpl:summary-revision"]').content='test-image-revision';
    expect(new URL(h.run('shareContext().image')).searchParams.get('v')).toBe('test-image-revision');
    h.link('#player/O4MA.');expect(h.get('main').innerHTML).toContain('<h1>O4MA.</h1>');
    expect(h.run('shareContext().params.get("view")')).toBe('player');
    h.link('#team/gigo');h.link('#player/HIBIKI');
    for(let n=0;n<3;n++)h.history.back();h.flush();
    expect(h.get('#team-roster-season').value).toBe('2');
    expect(h.location.searchParams.get('id')).toBe('round1');
    h.history.forward();h.flush();expect(h.get('main').innerHTML).toContain('<h1>O4MA.</h1>');
    for(const roster of ['all','0','unavailable']) {
      const invalid=harness('/bpl/s?view=team&id=round1&rosterSeason='+roster);
      expect(invalid.get('#team-roster-season').value).toBe('6');
      expect(invalid.location.searchParams.get('rosterSeason')).toBe('6');
    }
  });

  it('pushes seasons, replaces filters, and restores list query, ordering and ZERO', () => {
    const h=harness('/bpl/s?view=seasons&season=0&team=WHITE&stage=final');
    h.run('navigate({view:"seasons",id:null,filters:{...state,season:"5"}})');
    h.get('#team-filter').onchange?.({target:{value:'all'}});h.get('#stage-filter').onchange?.({target:{value:'all'}});
    expect(h.history.length).toBe(2);h.history.back();h.flush();
    expect(h.location.searchParams.get('season')).toBe('0');expect(h.get('#team-filter').value).toBe('WHITE');
    expect(h.get('#stage-filter').value).toBe('final');expect(h.get('main').innerHTML).toContain('ZEROの対戦カード');
    h.link('#players/s6');
    h.get('#player-sort').onchange?.({target:{value:'name'}});h.get('#player-team').onchange?.({target:{value:'round1'}});
    h.get('#player-search').oninput?.({target:{value:'O4MA.'}});expect(h.location.searchParams.get('query')).toBe('O4MA.');h.link('#player/O4MA.');h.history.back();h.flush();
    expect(h.location.searchParams.get('query')).toBe('O4MA.');expect(h.get('#player-season').value).toBe('6');
    expect(h.get('#player-team').value).toBe('round1');expect(h.get('#player-sort').value).toBe('name');
  });

  it('Back closes and Forward reopens match dialogs; close, Escape and backdrop share the same history behavior', () => {
    const h=harness('/bpl/s?view=team&id=round1&rosterSeason=2');
    const id=data.matches.find(m=>m.teams.includes('round1'))!.id;
    const writes=h.mainWrites;
    h.run(`openMatch(${JSON.stringify(id)})`);expect(h.get('#match-dialog').open).toBe(true);
    expect(h.location.searchParams.get('view')).toBe('match');
    h.history.back();h.flush();expect(h.get('#match-dialog').open).toBe(false);expect(h.get('#team-roster-season').value).toBe('2');
    h.history.forward();h.flush();expect(h.get('#match-dialog').open).toBe(true);
    h.get('#close-dialog').onclick?.({});h.flush();expect(h.location.searchParams.get('view')).toBe('team');
    h.history.forward();h.flush();h.get('#match-dialog').dispatch('cancel',{preventDefault(){}});h.flush();expect(h.get('#match-dialog').open).toBe(false);
    h.history.forward();h.flush();h.get('#match-dialog').dispatch('click',{target:h.get('#match-dialog'),clientX:0,clientY:0});h.flush();expect(h.location.searchParams.get('id')).toBe('round1');
    expect(h.history.length).toBe(2);
    expect(h.mainWrites).toBe(writes); // Modal history leaves its opener and scroll position intact.
  });

  it('direct match dismissal never leaves the archive and old duplicate hash events do not render twice', () => {
    const match=data.matches.find(m=>m.season===0)!;
    const h=harness('/bpl/s?view=match&id='+match.id+'#seasons');
    expect(h.get('#match-dialog').open).toBe(true);h.get('#close-dialog').onclick?.({});h.flush();
    expect(h.history.length).toBe(1);expect(h.location.searchParams.get('view')).toBe('seasons');expect(h.location.searchParams.get('season')).toBe('0');
    const writes=h.mainWrites;h.emit('popstate');h.emit('hashchange');expect(h.mainWrites).toBe(writes);
    const legacy=harness('/bpl#player/O4MA.');expect(legacy.location.hash).toBe('');expect(legacy.location.searchParams.get('id')).toBe('O4MA.');
  });

  it('restores hidden S6 state through future-match reveal and history', () => {
    const h=harness('/bpl/s?view=s6&hideResults=1',true);
    h.run('openMatch("s6-future")');expect(h.get('#dialog-content').innerHTML).toContain('S6の結果を隠しています');
    expect(h.get('#dialog-content').innerHTML).not.toContain('99');
    h.get('#s6-reveal-all').onclick?.({});h.flush();expect(h.get('#dialog-content').innerHTML).toContain('99 : 1');
    expect(h.location.searchParams.get('hideResults')).toBe('0');
    h.history.back();h.flush();expect(h.run('s6SessionPrefs.hideResults')).toBe(true);
    h.history.forward();h.flush();expect(h.get('#dialog-content').innerHTML).toContain('99 : 1');
    expect(h.run('s6SessionPrefs.favorite')).toBe('');
  });

  it('excludes draws from player rates while preserving song counts and roster art', () => {
    const h=harness('/bpl/s?view=player&id=O4MA.');
    for(const player of data.players){const result=h.run(`stats(${JSON.stringify(player.id)})`);expect(result.rate).toBe(result.wins+result.losses?Math.round(result.wins/(result.wins+result.losses)*100):null);expect(result.songs).toBe(result.wins+result.losses+result.draws);expect(result.ownDecided).toBeLessThanOrEqual(result.ownN)}
    expect(h.get('main').innerHTML).toContain('/bpl/portraits/');expect(h.get('main').innerHTML).toContain('/bpl/seasons/');
    expect(app).not.toContain('new MutationObserver');
  });
});

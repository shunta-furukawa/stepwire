/**
 * Real browser regression suite; run against `pnpm dev` or `pnpm start`:
 *   BASE_URL=http://127.0.0.1:3000 node tests/bpl-history.browser.mjs
 * Requires Playwright in the runner (NODE_PATH is supported) and a Chromium
 * installation. Set CHROMIUM_PATH only when using a system browser.
 * No browser or package is downloaded by this script.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const { chromium }=require('playwright');
const data=JSON.parse(await readFile(new URL('../public/bpl/data.json',import.meta.url),'utf8'));
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}: {})});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
await context.addInitScript(()=>{
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text}}});
});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const param=key=>new URL(page.url()).searchParams.get(key);
async function ready(view,id){await page.waitForFunction(({view,id})=>{const p=new URLSearchParams(location.search);return p.get('view')===view&&(!id||p.get('id')===id)&&!document.querySelector('main .loading')},{view,id});}
async function goto(path,view,id){await page.goto(base+path);await ready(view,id)}
async function nav(view){await page.locator(`nav a[href="#${view}"]`).click();await ready(view)}
async function back(view,id){await page.goBack();await ready(view,id)}
async function forward(view,id){await page.goForward();await ready(view,id)}
async function modal(open){await page.waitForFunction(open=>document.querySelector('#match-dialog').open===open,open)}
async function copy(){await page.locator('.share-toolbar [data-share-action="copy"]').click();return new URL(await page.evaluate(()=>window.__copied))}
async function checkArt(){assert.ok(await page.locator('main img[src^="/bpl/portraits/"]').count());assert.ok(await page.locator('main img[src^="/bpl/seasons/"]').count());}
const trimPlaintextPunctuation=value=>value.replace(/[.,!?;:)\]}"'。、！？）］｝」』】]+$/u,'');
function checkPlayerLink(value,id){
  assert.match(value,/&linkVersion=1$/);
  assert.equal(trimPlaintextPunctuation(value),value);
  assert.equal(trimPlaintextPunctuation(value+'.)'),value);
  assert.equal(new URL(value).searchParams.get('id'),id);
  if(id.includes('.'))assert.ok(value.includes('%2E'),value);
}
try {
  // Repeated entity navigation must retain the selected entity and roster scope.
  await goto('/bpl/s?view=team&id=round1&rosterSeason=2','team','round1');
  assert.equal(await page.locator('#team-roster-season').inputValue(),'2');
  for(let i=0;i<3;i++){
    await page.locator('#team-roster a[href="#player/O4MA."]').click();await ready('player','O4MA.');await checkArt();
    let shared=await copy();assert.equal(shared.searchParams.get('view'),'player');assert.equal(shared.searchParams.get('id'),'O4MA.');
    await page.locator('.share-toolbar [data-share-action="preview"]').click();
    assert.equal(new URL(await page.locator('#share-preview-image').getAttribute('src')).searchParams.get('id'),'O4MA.');
    await page.locator('#share-preview-close').click();
    await back('team','round1');assert.equal(await page.locator('#team-roster-season').inputValue(),'2');
    shared=await copy();assert.equal(shared.searchParams.get('view'),'team');assert.equal(shared.searchParams.get('rosterSeason'),'2');
    await forward('player','O4MA.');await back('team','round1');
  }
  assert.equal(new URL(page.url()).hash,'');
  const beforeSkip=page.url();await page.locator('.skip').focus();await page.keyboard.press('Enter');assert.equal(page.url(),beforeSkip);

  // A season selection is an intentional step; filters replace that step.
  await nav('seasons');
  await page.locator('[data-season="0"]').click();await page.waitForURL(u=>u.searchParams.get('season')==='0');
  await page.selectOption('#team-filter','WHITE');await page.selectOption('#stage-filter','final');
  const zero=page.url();
  await page.locator('[data-season="5"]').click();await page.waitForURL(u=>u.searchParams.get('season')==='5');
  await page.selectOption('#team-filter','all');await page.selectOption('#stage-filter','all');
  await back('seasons');assert.equal(page.url(),zero);assert.equal(await page.locator('#team-filter').inputValue(),'WHITE');assert.equal(await page.locator('#stage-filter').inputValue(),'final');
  await forward('seasons');assert.equal(param('season'),'5');assert.equal(await page.locator('#team-filter').inputValue(),'all');

  // Search replaces one history step; immediate navigation keeps the last text.
  await nav('players');await page.selectOption('#player-season','6');await page.selectOption('#player-team','round1');await page.selectOption('#player-sort','name');
  await page.fill('#player-search','O4MA.');await page.locator('#player-grid a[href="#player/O4MA."]').click();await ready('player','O4MA.');
  await back('players');assert.equal(await page.locator('#player-search').inputValue(),'O4MA.');assert.equal(await page.locator('#player-season').inputValue(),'6');assert.equal(await page.locator('#player-team').inputValue(),'round1');assert.equal(await page.locator('#player-sort').inputValue(),'name');

  // All modal exits preserve the underlying page and allow Forward to reopen.
  await goto('/bpl/s?view=team&id=round1&rosterSeason=2','team','round1');
  const underlying=page.url();await page.locator('main [data-match]').first().click();await ready('match');await modal(true);const matchId=param('id');
  await back('team','round1');await modal(false);assert.equal(page.url(),underlying);
  for(const exit of ['close','escape','backdrop']){
    await forward('match',matchId);await modal(true);
    if(exit==='close')await page.locator('#close-dialog').click();
    if(exit==='escape')await page.keyboard.press('Escape');
    if(exit==='backdrop')await page.mouse.click(1,1);
    await ready('team','round1');await modal(false);assert.equal(page.url(),underlying);assert.equal(await page.locator('#team-roster-season').inputValue(),'2');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.match),matchId);
  }
  // A direct link must close in-place rather than navigate to another website.
  const zeroMatch=data.matches.find(m=>m.season===0);
  await goto('/bpl/s?view=match&id='+encodeURIComponent(zeroMatch.id),'match',zeroMatch.id);await modal(true);await page.keyboard.press('Escape');await ready('seasons');assert.equal(param('season'),'0');await modal(false);

  // Copy the real toolbar URL, then reopen the plaintext-autolinked URL in a
  // separate page so old client state cannot mask an incorrect player or OG card.
  const fresh=await context.newPage(),sharedPlayers=new Set();
  fresh.on('pageerror',error=>errors.push(error.message));
  for(const id of ['O4MA.','ZERO.','A.N.C.B.','MOO-G.56','$RYO$','UN-RE']){
    await goto('/bpl/s?view=player&id='+encodeURIComponent(id),'player',id);
    assert.equal(await page.locator('main h1').innerText(),id);
    checkPlayerLink(page.url(),id);
    const shared=(await copy()).href;
    checkPlayerLink(shared,id);sharedPlayers.add(shared);
    await page.locator('.share-toolbar [data-share-action="preview"]').click();
    const preview=new URL(await page.locator('#share-preview-image').getAttribute('src'));
    checkPlayerLink(preview.href,id);assert.equal(preview.pathname,'/bpl/og');assert.equal(preview.searchParams.get('summaryVersion'),'1');
    await page.locator('#share-preview-close').click();
    await fresh.goto(trimPlaintextPunctuation(shared+'.)'));
    await fresh.waitForFunction(id=>new URLSearchParams(location.search).get('id')===id&&!document.querySelector('main .loading'),id);
    assert.equal(await fresh.locator('main h1').innerText(),id);
    assert.equal(await fresh.title(),id+' — BPL DDR RECORDS');
    checkPlayerLink(fresh.url(),id);
    assert.equal(await fresh.locator('meta[property="og:title"]').getAttribute('content'),id+' — STEPWIRE');
    assert.equal(await fresh.locator('meta[name="twitter:title"]').getAttribute('content'),id+' — STEPWIRE');
    const canonical=await fresh.locator('link[rel="canonical"]').getAttribute('href');
    assert.equal(await fresh.locator('meta[property="og:url"]').getAttribute('content'),canonical);
    checkPlayerLink(canonical,id);
    const image=new URL(await fresh.locator('meta[property="og:image"]').getAttribute('content'));
    checkPlayerLink(image.href,id);assert.equal(image.pathname,'/bpl/og');assert.equal(image.searchParams.get('summaryVersion'),'1');
    assert.equal(await fresh.locator('meta[name="twitter:image"]').getAttribute('content'),image.href);
    assert.equal(image.searchParams.get('v'),await fresh.locator('meta[name="bpl:summary-revision"]').getAttribute('content'));
    assert.equal(image.searchParams.get('v'),preview.searchParams.get('v'));
    if(id==='O4MA.'){
      const response=await context.request.get(base+image.pathname+image.search);
      assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/^image\/png/);
      const png=await response.body();
      assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
      assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
    }
  }
  assert.equal(sharedPlayers.size,6);await fresh.close();

  // Legacy hash URLs, punctuation IDs, duel filters and matrix filters survive.
  await goto('/bpl/index.html#player/%24RYO%24','player','$RYO$');assert.equal((await copy()).searchParams.get('id'),'$RYO$');
  await goto('/bpl/s?view=versus&vsFormat=tag&vsSeason=4#versus/O4MA./HIBIKI','versus');
  assert.equal(await page.locator('#vs-a').inputValue(),'O4MA.');assert.equal(await page.locator('#vs-format').inputValue(),'tag');assert.equal(await page.locator('#vs-season').inputValue(),'4');
  await nav('teams');await back('versus');assert.equal(await page.locator('#vs-format').inputValue(),'tag');
  await goto('/bpl/s?view=matrix&previewA=round1&previewB=gigo&matrixSeason=5&matrixFormat=single&matrixCategory=GOLD&matrixStyle=TRICKY','matrix');
  await nav('players');await back('matrix');
  for(const [key,value] of Object.entries({matrixSeason:'5',matrixFormat:'single',matrixCategory:'GOLD',matrixStyle:'TRICKY'}))assert.equal(await page.locator('#'+key).inputValue(),value);
  for(const roster of ['all','0']){await goto('/bpl/s?view=team&id=round1&rosterSeason='+roster,'team','round1');assert.equal(await page.locator('#team-roster-season').inputValue(),'6');assert.equal(param('rosterSeason'),'6')}

  // Simulate future official data at the fetch boundary, without changing source data.
  await page.route('**/bpl/data.json',async route=>{
    const fixture=structuredClone(data);fixture.matches.push({...structuredClone(data.matches[0]),id:'s6-future',season:6,points:[99,1]});
    await route.fulfill({json:fixture});
  });
  await goto('/bpl/s?view=s6&hideResults=1','s6');await page.locator('[data-match="s6-future"]').click();await ready('match','s6-future');await modal(true);
  assert.match(await page.locator('#dialog-content').innerText(),/S6の結果を隠しています/);assert.doesNotMatch(await page.locator('#dialog-content').innerText(),/99/);
  await page.locator('#s6-reveal-all').click();await page.waitForURL(u=>u.searchParams.get('hideResults')==='0');assert.match(await page.locator('.dialog-score').innerText(),/99 : 1/);
  await back('s6');assert.equal(await page.locator('#s6-spoilers').isChecked(),true);
  await forward('match','s6-future');await modal(true);assert.match(await page.locator('.dialog-score').innerText(),/99 : 1/);
  assert.deepEqual(errors,[]);console.log('BPL browser history regressions passed');
} finally {await context.close();await browser.close()}

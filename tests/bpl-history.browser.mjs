/**
 * Real browser regression suite; run against `pnpm dev` or `pnpm start`:
 *   BASE_URL=http://127.0.0.1:3000 node tests/bpl-history.browser.mjs
 * Requires Playwright in the runner (NODE_PATH is supported) and a Chromium
 * installation. Set CHROMIUM_PATH only when using a system browser.
 * Set BPL_SCREENSHOT_OUTPUT to save desktop/mobile card, detail and versus PNGs.
 * No browser or package is downloaded by this script.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const require=createRequire(import.meta.url);
const { chromium }=require('playwright');
const sharp=require('sharp');
const data=JSON.parse(await readFile(new URL('../public/bpl/data.json',import.meta.url),'utf8'));
const jacketColors=JSON.parse(await readFile(new URL('../public/bpl/jacket-colors.json',import.meta.url),'utf8'));
const missingJackets=['3y3s','Bad Maniacs','Fly Like You','Ganymede -re:born-','Thunderstorm','コメット⇒スケイター','恋歌疾風！かるたクイーンいろは'];
const screenshotOutput=process.env.BPL_SCREENSHOT_OUTPUT?resolve(process.env.BPL_SCREENSHOT_OUTPUT):null;
if(screenshotOutput)await mkdir(screenshotOutput,{recursive:true});
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const externalImageRequests=[];
function trackImages(ctx){ctx.on('request',request=>{
  if(request.resourceType()==='image'&&new URL(request.url()).origin!==new URL(base).origin)externalImageRequests.push(request.url());
});}
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}: {})});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
trackImages(context);
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

async function readyOn(target,view,id){
  await target.waitForFunction(({view,id})=>{const p=new URLSearchParams(location.search);return p.get('view')===view&&(!id||p.get('id')===id)&&!document.querySelector('main .loading')},{view,id});
}
async function screenshot(target,name){
  if(screenshotOutput)await target.screenshot({path:join(screenshotOutput,name+'.png'),animations:'disabled'});
}
async function checkJacket(target,size,palette=null){
  assert.equal(await target.count(),1);
  const actual=await target.evaluate(element=>{
    const style=getComputedStyle(element),box=element.getBoundingClientRect();
    const metrics=({width,height,fontFamily,fontSize,lineHeight,letterSpacing})=>({width,height,fontFamily,fontSize,lineHeight,letterSpacing});
    // Compare dimensions and typography to the old symbol in the same parent.
    const fallback=element.cloneNode(false);
    fallback.classList.remove('music-gradient');fallback.classList.add('music-symbol');fallback.removeAttribute('style');fallback.textContent='♪';
    element.after(fallback);const previous=metrics(getComputedStyle(fallback));fallback.remove();
    return {width:box.width,height:box.height,metrics:metrics(style),previous,
      variables:['tl','tr','bl','br'].map(key=>style.getPropertyValue('--jacket-'+key).trim()),
      background:style.backgroundImage,borderWidth:style.borderTopWidth,borderStyle:style.borderTopStyle,borderColor:style.borderTopColor,
      aria:element.getAttribute('aria-hidden'),html:element.outerHTML,text:element.textContent};
  });
  assert.equal(actual.width,size);assert.equal(actual.height,size);
  assert.deepEqual(actual.metrics,actual.previous,'jacket gradients must retain the existing dimensions and font');
  assert.equal(actual.aria,'true');assert.doesNotMatch(actual.html,/<img|https?:|url\(/i);
  assert.equal(actual.borderWidth,'1px');assert.equal(actual.borderStyle,'solid');
  assert.notEqual(actual.borderColor,'transparent');assert.notEqual(actual.borderColor,'rgba(0, 0, 0, 0)');
  if(palette){
    assert.deepEqual(actual.variables,['topLeft','topRight','bottomLeft','bottomRight'].map(key=>palette[key].toLowerCase()));
    assert.equal(actual.text,'');assert.match(actual.html,/music-gradient/);
    assert.equal((actual.background.match(/radial-gradient\(/g)||[]).length,3);
    assert.doesNotMatch(actual.background,/url\(|linear-gradient\(/i);
  }else{
    assert.equal(actual.text,'♪');assert.match(actual.html,/music-symbol/);assert.equal(actual.background,'none');
  }
}
async function checkPaleJacket(target){
  const {data:pixels,info}=await sharp(await target.screenshot({animations:'disabled'})).removeAlpha().raw().toBuffer({resolveWithObject:true});
  for(const [x,y] of [[.25,.25],[.75,.25],[.25,.75],[.75,.75],[.5,.5]]){
    const offset=(Math.floor(y*info.height)*info.width+Math.floor(x*info.width))*info.channels;
    assert.ok([...pixels.subarray(offset,offset+3)].every(channel=>channel>170),'pale Cosy palette must remain visible against the dark surrounding surface');
  }
  const parentColor=await target.evaluate(element=>getComputedStyle(element.closest('.match-card,.song,td')).backgroundColor);
  assert.ok(parentColor==='rgba(0, 0, 0, 0)'||parentColor.match(/\d+/g).slice(0,3).every(channel=>Number(channel)<100),parentColor);
}
async function checkGradientLayout(label,viewport){
  const ctx=await browser.newContext({viewport,isMobile:label==='mobile',hasTouch:label==='mobile',deviceScaleFactor:1,serviceWorkers:'block'});
  trackImages(ctx);const target=await ctx.newPage();target.on('pageerror',error=>errors.push(error.message));
  const sizes=label==='mobile'?{mini:28,duel:44,detail:76}:{mini:34,duel:60,detail:96};
  try{
    // Use a real pale record in the archive, including its real score and title.
    const match=data.matches.find(m=>m.season===5&&m.battles.some(b=>b.songs.some(s=>s.name==='Cosy Catastrophe')));
    const titles=match.battles.flatMap(b=>b.songs.map(s=>s.name));
    await target.goto(base+'/bpl/s?view=seasons&season=5');await readyOn(target,'seasons');
    const card=target.locator(`.match-card[data-match="${match.id}"]`);
    const cosyMini=card.locator('.music-jacket').nth(titles.indexOf('Cosy Catastrophe'));
    await checkJacket(cosyMini,sizes.mini,jacketColors.songs['Cosy Catastrophe']);await checkPaleJacket(cosyMini);
    await screenshot(target.locator('.match-list'),label+'-jacket-card-grid');
    await card.click();await readyOn(target,'match',match.id);
    const cosyDetail=target.locator('#dialog-content .song').filter({has:target.locator('.song-title strong').filter({hasText:'Cosy Catastrophe'})}).locator('.music-jacket');
    await checkJacket(cosyDetail,sizes.detail,jacketColors.songs['Cosy Catastrophe']);await checkPaleJacket(cosyDetail);
    await cosyDetail.scrollIntoViewIfNeeded();await screenshot(target.locator('#match-dialog'),label+'-jacket-detail');
    await target.locator('#close-dialog').click();await readyOn(target,'seasons');
    await target.goto(base+'/bpl/s?view=versus&a=HIBIKI&b=NOTTY&vsSeason=5&vsFormat=all');await readyOn(target,'versus');
    const cosyDuel=target.locator('.duel-song-heading').filter({has:target.locator('.duel-song-name').filter({hasText:'Cosy Catastrophe'})}).locator('.music-jacket');
    await checkJacket(cosyDuel,sizes.duel,jacketColors.songs['Cosy Catastrophe']);await checkPaleJacket(cosyDuel);
    await screenshot(target.locator('.duel-table'),label+'-jacket-versus');

    // Verify all seven known missing titles use their actual card and detail ♪,
    // without inventing a replacement palette or relying on a single fixture.
    await target.goto(base+'/bpl/s?view=seasons');await readyOn(target,'seasons');
    for(const title of missingJackets){
      const missingMatch=data.matches.find(m=>m.battles.some(b=>b.songs.some(s=>s.name===title)));
      const missingTitles=missingMatch.battles.flatMap(b=>b.songs.map(s=>s.name));
      const missingCard=target.locator(`.match-card[data-match="${missingMatch.id}"]`);
      await checkJacket(missingCard.locator('.music-jacket').nth(missingTitles.indexOf(title)),sizes.mini);
      await missingCard.click();await readyOn(target,'match',missingMatch.id);
      const detail=target.locator('#dialog-content .song').filter({has:target.locator('.song-title strong').filter({hasText:title})}).locator('.music-jacket');
      assert.ok(await detail.count(),title);
      for(const jacket of await detail.all())await checkJacket(jacket,sizes.detail);
      await target.locator('#close-dialog').click();await readyOn(target,'seasons');
    }
  }finally{await ctx.close()}
}
async function checkOptionalJacketFailure(failure){
  const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});trackImages(ctx);
  await ctx.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text}}}));
  const target=await ctx.newPage();target.on('pageerror',error=>errors.push(error.message));
  try{
    if(['module','both'].includes(failure))await target.route('**/bpl/jackets.js',route=>route.abort('failed'));
    if(failure.startsWith('palette-')||failure==='both')await target.route('**/bpl/jacket-colors.json',route=>{
      if(['palette-network','both'].includes(failure))return route.abort('failed');
      if(failure==='palette-status')return route.fulfill({status:503,contentType:'application/json',body:'{}'});
      return route.fulfill({status:200,contentType:'application/json',body:'{invalid JSON'});
    });
    await target.goto(base+'/bpl/s?view=seasons&season=5');await readyOn(target,'seasons');
    assert.equal(await target.locator('.match-card').count(),data.matches.filter(m=>m.season===5).length);
    assert.ok(await target.locator('.music-symbol.mini-jacket').count());assert.equal(await target.locator('.music-gradient').count(),0);
    await target.selectOption('#team-filter','round1');assert.equal(new URL(target.url()).searchParams.get('team'),'round1');
    await target.locator('nav a[href="#players"]').click();await readyOn(target,'players');
    await target.fill('#player-search','O4MA.');await target.locator('#player-grid a[href="#player/O4MA."]').click();await readyOn(target,'player','O4MA.');
    await target.locator('.share-toolbar [data-share-action="copy"]').click();checkPlayerLink(await target.evaluate(()=>window.__copied),'O4MA.');
    await target.goBack();await readyOn(target,'players');assert.equal(await target.locator('#player-search').inputValue(),'O4MA.');
    await target.goForward();await readyOn(target,'player','O4MA.');
    await target.locator('nav a[href="#seasons"]').click();await readyOn(target,'seasons');
    const card=target.locator('.match-card').first(),id=await card.getAttribute('data-match');
    await card.click();await readyOn(target,'match',id);
    assert.ok(await target.locator('#dialog-content .music-symbol').count());assert.equal(await target.locator('#dialog-content .music-gradient').count(),0);
    await target.goBack();await readyOn(target,'seasons');assert.equal(await target.locator('#match-dialog').evaluate(dialog=>dialog.open),false);
    await target.goForward();await readyOn(target,'match',id);assert.equal(await target.locator('#match-dialog').evaluate(dialog=>dialog.open),true);
    await target.keyboard.press('Escape');await readyOn(target,'seasons');assert.equal(await target.locator('#match-dialog').evaluate(dialog=>dialog.open),false);
  }finally{await ctx.close()}
}
async function checkOutcomeLayout(label,viewport){
  const ctx=await browser.newContext({viewport,isMobile:label==='mobile',hasTouch:label==='mobile',deviceScaleFactor:1,serviceWorkers:'block'});
  trackImages(ctx);const target=await ctx.newPage();target.on('pageerror',error=>errors.push(error.message));
  try{
    // Establish the actual rendered W/D/L history palette rather than a new one.
    await target.goto(base+'/bpl/s?view=player&id=O4MA%2E');await readyOn(target,'player','O4MA.');
    const colors=await target.evaluate(()=>Object.fromEntries(['w','d','l'].map(result=>{
      const sample=document.createElement('span');sample.className='outcome '+result;document.body.append(sample);
      const style=getComputedStyle(sample),color={color:style.color,background:style.backgroundColor};sample.remove();return [result,color];
    })));
    await target.goto(base+'/bpl/s?view=match&id=s4-semi_01');await readyOn(target,'match','s4-semi_01');
    const battle=target.locator('.battle-detail').first(),song=battle.locator('.song').first();
    assert.deepEqual(await battle.locator('.lineup-side').evaluateAll(nodes=>nodes.map(n=>n.dataset.team)),['round1','silkhat']);
    assert.deepEqual(await battle.locator('.lineup-team').allTextContents(),['ROUND1','SILK HAT']);
    const teamStyles=await battle.locator('.lineup-side').evaluateAll(nodes=>nodes.map(n=>({border:getComputedStyle(n).borderLeftColor,text:getComputedStyle(n.querySelector('.lineup-team')).color})));
    assert.notEqual(teamStyles[0].border,teamStyles[1].border);assert.notEqual(teamStyles[0].text,teamStyles[1].text);
    assert.deepEqual(await song.locator('.result-badge').allTextContents(),['WIN','LOSE']);
    assert.deepEqual(await song.locator('.score-result>b').allTextContents(),['1,384','1,372']);
    for(const [side,result] of [[0,'w'],[1,'l']]){
      assert.deepEqual(await song.locator('.result-badge').nth(side).evaluate(n=>({color:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor})),colors[result]);
      assert.equal(await song.locator('.score-result>b').nth(side).evaluate(n=>getComputedStyle(n).color),colors[result].color);
    }
    assert.equal(await target.locator('#match-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
    await battle.scrollIntoViewIfNeeded();await screenshot(battle,label+'-match-outcomes');

    // Both players enter from their own recent W/L record; home/away order must not invert it.
    for(const id of ['$RYO$','A.N.C.B.']){
      await target.goto(base+'/bpl/s?view=player&id='+encodeURIComponent(id));await readyOn(target,'player',id);
      const entry=target.locator('.outcomes [data-match]').last(),matchId=await entry.getAttribute('data-match'),title=await entry.getAttribute('title'),expected=await entry.innerText();
      const match=data.matches.find(m=>m.id===matchId),b=match.battles.find(b=>b.type==='single'&&b.players.flat().includes(id)&&b.songs.some(s=>title.startsWith(s.name+'：')));
      const selectedSong=b.songs.find(s=>title.startsWith(s.name+'：')),side=b.players.findIndex(ps=>ps.includes(id));
      await entry.click();await readyOn(target,'match',matchId);
      const selected=target.locator('.song').filter({has:target.locator('.song-title strong').filter({hasText:selectedSong.name})}).first();
      assert.equal(await selected.locator('.result-badge').nth(side).innerText(),{W:'WIN',L:'LOSE',D:'DRAW'}[expected]);
      await target.goBack();await readyOn(target,'player',id);assert.equal(await target.locator('#match-dialog').evaluate(n=>n.open),false);
      await target.goForward();await readyOn(target,'match',matchId);await target.locator('#close-dialog').click();await readyOn(target,'player',id);
    }

    // A transferred player still belongs to the team recorded for this match.
    const old=data.matches.find(m=>m.teams.includes('game_panic')&&m.battles.some(b=>b.players.flat().includes('HO4-KETI')));
    await target.goto(base+'/bpl/s?view=match&id='+old.id);await readyOn(target,'match',old.id);
    const transferred=target.locator('.lineup-side').filter({has:target.locator('a[href="#player/HO4-KETI"]')});
    for(const lineup of await transferred.all())assert.equal(await lineup.getAttribute('data-team'),'game_panic');

    await target.goto(base+'/bpl/s?view=versus&a=O4MA%2E&b=KANAME');await readyOn(target,'versus');
    const duel=target.locator('.duel-table tr').filter({has:target.locator('.duel-song-name').filter({hasText:'恋閃繚乱'})});
    assert.deepEqual(await duel.locator('.comparison-label').allTextContents(),['個人EX','個人EX']);
    for(const column of [2,3])assert.equal(await target.locator(`.duel-table th:nth-child(${column})`).evaluate(n=>{const range=document.createRange();range.selectNodeContents(n);return range.getClientRects().length}),1,'selected player names should fit the mobile header');
    assert.deepEqual(await duel.locator('.score-result>b').allTextContents(),['1,510','1,513']);
    assert.deepEqual(await duel.locator('.score-difference').allTextContents(),['差 -3','差 +3']);
    assert.deepEqual(await duel.locator('.duel-pair-result .result-badge').allTextContents(),['DRAW','DRAW']);
    assert.equal(await duel.locator('.score-result>b').nth(0).evaluate(n=>getComputedStyle(n).color),colors.l.color);
    assert.equal(await duel.locator('.score-result>b').nth(1).evaluate(n=>getComputedStyle(n).color),colors.w.color);
    for(const badge of await duel.locator('.result-badge').all())assert.equal(await badge.evaluate(n=>getComputedStyle(n).color),colors.d.color);
    const single=target.locator('.duel-table tr').filter({has:target.locator('.duel-song-name').filter({hasText:'Throw Out'})});
    assert.deepEqual(await single.locator('.result-badge').allTextContents(),['LOSE','WIN']);
    await target.locator('.duel-table').scrollIntoViewIfNeeded();
    await target.locator('.duel-table').evaluate(n=>n.scrollIntoView({block:'start'}));
    await screenshot(target,label+'-duel-outcomes');
    assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'page must not overflow on mobile');
    await target.selectOption('#vs-a','KANAME');await target.selectOption('#vs-b','O4MA.');
    assert.deepEqual(await single.locator('.result-badge').allTextContents(),['WIN','LOSE']);
    assert.deepEqual(await duel.locator('.score-result>b').allTextContents(),['1,513','1,510']);
    assert.deepEqual(await duel.locator('.duel-pair-result .result-badge').allTextContents(),['DRAW','DRAW']);
    await single.locator('[data-match]').click();await readyOn(target,'match');await target.keyboard.press('Escape');await readyOn(target,'versus');
    assert.equal(await target.locator('#vs-a').inputValue(),'KANAME');assert.equal(await target.locator('#vs-b').inputValue(),'O4MA.');

    // Boundary fixtures are intercepted in this isolated context only.
    await target.route('**/bpl/data.json',route=>{
      const fixture=structuredClone(data),m=fixture.matches.find(m=>m.id==='s4-semi_01'),b=m.battles[0],s=b.songs[0];
      b.songs=[{...s,name:'Zero draw fixture',scores:[0,0],points:[0,0]},{...s,name:'Unknown fixture',scores:[null,0],points:[null,0]}];
      return route.fulfill({json:fixture});
    });
    await target.goto(base+'/bpl/s?view=match&id=s4-semi_01');await readyOn(target,'match','s4-semi_01');
    const fixtureSongs=target.locator('.battle-detail').first().locator('.song');
    assert.deepEqual(await fixtureSongs.nth(0).locator('.result-badge').allTextContents(),['DRAW','DRAW']);
    assert.deepEqual(await fixtureSongs.nth(1).locator('.result-badge').allTextContents(),['—','—']);
    assert.deepEqual(await fixtureSongs.nth(1).locator('.score-result>b').allTextContents(),['—','0']);
  }finally{await ctx.close()}
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

  await checkOutcomeLayout('desktop',{width:1280,height:900});
  await checkOutcomeLayout('mobile',{width:390,height:844});
  await checkGradientLayout('desktop',{width:1280,height:900});
  await checkGradientLayout('mobile',{width:390,height:844});
  for(const failure of ['palette-network','palette-status','palette-json','module','both'])await checkOptionalJacketFailure(failure);

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
  assert.deepEqual(externalImageRequests,[],'BPL must not request external jacket or other image assets');
  assert.deepEqual(errors,[]);console.log('BPL browser history and jacket regressions passed'+(screenshotOutput?' (screenshots: '+screenshotOutput+')':''));
} finally {await context.close();await browser.close()}

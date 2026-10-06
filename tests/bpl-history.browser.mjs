/**
 * Real browser regression suite; run against `pnpm dev` or `pnpm start`:
 *   BASE_URL=http://127.0.0.1:3000 node tests/bpl-history.browser.mjs
 * Requires Playwright in the runner (NODE_PATH is supported) and a Chromium
 * installation. Set CHROMIUM_PATH only when using a system browser.
 * Set BPL_SCREENSHOT_OUTPUT to save desktop/mobile standings, card, detail and versus PNGs.
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

    // These real archive records span the approved pink/purple recovery,
    // a white-to-cyan selection, and an unchanged dark jacket, at all 3 sizes.
    for(const [title,matchId,a,b,season,format] of [
      ['Wuv U','s4-regular_06','THOR','GIEZ-ACS','4','tag'],
      ['ALPACORE','s2-regular-6','THOR','KANAME','2','tag'],
      ['888','s2-regular-9','UN-RE','OOON!!','2','single'],
    ]){
      const record=data.matches.find(m=>m.id===matchId),palette=jacketColors.songs[title];
      const slug=title.toLowerCase().replace(/[^a-z0-9]+/g,'-');
      await target.goto(base+'/bpl/s?view=seasons&season='+season);await readyOn(target,'seasons');
      const sampleCard=target.locator(`.match-card[data-match="${matchId}"]`);
      const index=record.battles.flatMap(battle=>battle.songs.map(song=>song.name)).indexOf(title);
      await checkJacket(sampleCard.locator('.music-jacket').nth(index),sizes.mini,palette);
      await screenshot(sampleCard,label+'-moderate-'+slug+'-card');
      await sampleCard.click();await readyOn(target,'match',matchId);
      const sampleDetail=target.locator('#dialog-content .song').filter({has:target.locator('.song-title strong').filter({hasText:title})}).locator('.music-jacket').first();
      await checkJacket(sampleDetail,sizes.detail,palette);
      await sampleDetail.scrollIntoViewIfNeeded();await screenshot(target.locator('#match-dialog'),label+'-moderate-'+slug+'-detail');
      await target.locator('#close-dialog').click();await readyOn(target,'seasons');
      const query=new URLSearchParams({view:'versus',a,b,vsSeason:season,vsFormat:format});
      await target.goto(base+'/bpl/s?'+query);await readyOn(target,'versus');
      const sampleDuel=target.locator('.duel-song-heading').filter({has:target.locator('.duel-song-name').filter({hasText:title})}).locator('.music-jacket').first();
      await checkJacket(sampleDuel,sizes.duel,palette);
      await sampleDuel.scrollIntoViewIfNeeded();await screenshot(target.locator('.duel-table'),label+'-moderate-'+slug+'-versus');
    }

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
async function checkRoundPoints(label,viewport){
  const ctx=await browser.newContext({viewport,isMobile:label!=='desktop',hasTouch:label!=='desktop',deviceScaleFactor:1,serviceWorkers:'block'});
  trackImages(ctx);const target=await ctx.newPage();target.on('pageerror',error=>errors.push(error.message));
  try{
    await target.goto(base+'/bpl/s?view=seasons');await readyOn(target,'seasons');
    for(const match of data.matches){
      const card=target.locator(`.match-card[data-match="${match.id}"]`),rows=card.locator('.match-battle-row');
      assert.equal(await rows.count(),match.battles.length);
      const description=await card.getAttribute('aria-describedby');
      assert.equal(description,'round-summary-'+match.id);
      assert.match(await target.locator('#'+description).textContent(),/第1ラウンド：/);
      assert.deepEqual(await card.locator('.round-team-label').evaluateAll(nodes=>nodes.map(n=>n.dataset.team)),match.teams);
      const totals=[0,0];
      for(const [index,battle] of match.battles.entries()){
        const row=rows.nth(index),points=battle.points??[0,1].map(side=>battle.songs.reduce((sum,song)=>sum+song.points[side],0));
        assert.deepEqual(await row.locator('.round-point').allTextContents(),points.map(String),match.id+' round '+battle.number);
        assert.deepEqual(await row.locator('.round-point').evaluateAll(nodes=>nodes.map(n=>n.dataset.team)),match.teams);
        for(const side of [0,1]){
          totals[side]+=points[side];
          const number=row.locator('.round-point').nth(side),header=card.locator('.round-team-label').nth(side);
          assert.match(await number.getAttribute('aria-label'),new RegExp('第'+battle.number+'ラウンド'));
          assert.equal(await number.evaluate(n=>getComputedStyle(n).color),await header.evaluate(n=>getComputedStyle(n).color));
          if(match.teams[side]==='supernova_tohoku')assert.equal(await header.evaluate(n=>{const range=document.createRange();range.selectNodeContents(n);return range.getClientRects().length}),1,'SUPERNOVA header must fit without a dangling letter');
          const n=await number.boundingBox(),h=await header.boundingBox();
          assert.ok(Math.abs(n.x+n.width/2-h.x-h.width/2)<1,'round score centers align with team headings');
        }
        assert.equal(await row.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,match.id+' round row must not overflow');
      }
      assert.deepEqual(totals.map((n,side)=>n+match.adjustment[side]),match.points,'round totals + one adjustment agree with match total');
      assert.equal(await card.locator('.match-adjustment').count(),match.adjustment.some(Boolean)?1:0);
      assert.equal(await card.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,match.id+' card must not overflow');
    }
    assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'round points must not overflow page');
    for(const id of ['zero-0','s2-quarter-2','s2-regular-1','s4-semi_01','s5-final-1']){
      const card=target.locator(`.match-card[data-match="${id}"]`);
      if(await card.count()){await card.scrollIntoViewIfNeeded();await screenshot(card,label+'-round-points-'+id)}
    }
    await target.goto(base+'/bpl/s?view=seasons&season=5');await readyOn(target,'seasons');
    await target.locator('.season-team-filters').scrollIntoViewIfNeeded();await screenshot(target.locator('.season-team-filters'),label+'-participant-filters');
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
async function checkSeasonStandings(label,viewport){
  const ctx=await browser.newContext({viewport,isMobile:label==='mobile',hasTouch:label==='mobile',deviceScaleFactor:1,serviceWorkers:'block'});
  trackImages(ctx);
  await ctx.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text}}}));
  const target=await ctx.newPage();target.on('pageerror',error=>errors.push(error.message));
  const franchises=['apina_vrames','gigo','game_panic','silkhat','supernova_tohoku','taitostation_tradz','round1','leisure_land'];
  const current=franchises.filter(id=>id!=='supernova_tohoku');
  const expected={0:[['BLUE','WHITE','RED']],2:[['silkhat','gigo','game_panic','taitostation_tradz'],['round1','leisure_land','apina_vrames','supernova_tohoku']],4:[['round1','taitostation_tradz','game_panic','silkhat','gigo','leisure_land','apina_vrames']],5:[['taitostation_tradz','apina_vrames','round1','gigo','game_panic','silkhat','leisure_land']]};
  const filterState=async()=>({season:new URL(target.url()).searchParams.get('season'),team:await target.locator('#team-filter').inputValue(),stage:await target.locator('#stage-filter').inputValue()});
  const openSeason=async season=>{await target.goto(base+'/bpl/s?view=seasons&season='+season);await readyOn(target,'seasons');};
  const chooseSeason=async season=>{await target.locator(`button.season-button[data-season="${season}"]`).click();await target.waitForURL(url=>url.searchParams.get('season')===String(season));await readyOn(target,'seasons');};
  const noOverflow=async()=>assert.equal(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label+' season page must not overflow');
  const checkCards=async(season,team='all',stage='all')=>assert.deepEqual(await target.locator('#season-matches .match-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.match)),data.matches.filter(m=>(season==='all'||m.season===Number(season))&&(team==='all'||m.teams.includes(team))&&(stage==='all'||m.stage===stage)).reverse().map(m=>m.id));
  const checkButtons=async participants=>{
    const visible=['all',...Object.keys(data.teams).filter(id=>participants.includes(id))];
    assert.deepEqual(await target.locator('.season-team-filters button[data-team-filter]').evaluateAll(nodes=>nodes.map(node=>node.dataset.teamFilter)),visible);
    assert.deepEqual(await target.locator('#team-filter option').evaluateAll(nodes=>nodes.map(node=>node.value)),visible);
    for(const id of Object.keys(data.teams)){
      const button=target.locator(`button[data-team-filter="${id}"]`),option=target.locator(`#team-filter option[value="${id}"]`),available=participants.includes(id);
      assert.equal(await button.count(),available?1:0,id+' filter participation');
      assert.equal(await option.count(),available?1:0,id+' select participation');
      if(available){assert.equal(await button.isDisabled(),false);assert.equal(await option.isDisabled(),false)}
    }
    // Nonparticipants are absent from the DOM and native keyboard tab order.
    await target.locator('button[data-team-filter="all"]').focus();
    for(const id of visible.slice(1)){
      await target.keyboard.press('Tab');
      assert.equal(await target.evaluate(()=>document.activeElement?.dataset.teamFilter),id,'only participants belong in Tab order');
    }
    await target.keyboard.press('Tab');assert.equal(await target.evaluate(()=>document.activeElement?.id),'team-filter');
  };
  try{
    for(const season of ['0','2','4','5']){
      await openSeason(season);
      const section=target.locator(`.season-results[data-season="${season}"]`),groups=expected[season],seasonName=season==='0'?'ZERO':'S'+season;
      assert.equal(await section.count(),1);assert.equal(await section.locator('h2').innerText(),seasonName+'の順位・成績');
      assert.equal(await section.evaluate(n=>Boolean(n.compareDocumentPosition(document.querySelector('#season-matches'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'whole-season results precede card filters');
      assert.equal(await section.locator('.standings-table').count(),groups.length);
      for(const [index,ids] of groups.entries()){
        const table=section.locator('.standings-table').nth(index);
        assert.deepEqual(await table.locator('tbody .standings-row').evaluateAll(nodes=>nodes.map(n=>n.dataset.team)),ids);
        assert.deepEqual(await table.locator('.standing-rank').allTextContents(),ids.map((_,i)=>String(i+1)),'each group has its own ranking');
        assert.equal(await table.locator('thead th[scope="col"]').count(),5);assert.equal(await table.locator('tbody th[scope="row"]').count(),ids.length);
      }
      if(season==='2')assert.deepEqual(await section.locator('caption').allTextContents(),['Aグループ','Bグループ']);
      if(season==='0'){
        assert.match(await section.innerText(),/エキシビション/);
        assert.deepEqual(await section.locator('.standing-points').allTextContents(),['6','3','0']);
        assert.deepEqual(await section.locator('.standing-finish').allTextContents(),['準優勝','優勝','予選敗退']);
      }
      const final=data.matches.find(m=>m.season===Number(season)&&m.stage==='final'),winner=final.points[0]>final.points[1]?0:1;
      assert.deepEqual(await section.locator('.season-finalist').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),[winner,1-winner].map(side=>'#team/'+final.teams[side]));
      assert.deepEqual(await section.locator('.finish-label').allTextContents(),['優勝','準優勝']);
      assert.equal(await section.locator('.season-final-score').getAttribute('data-match'),final.id);
      assert.equal((await section.locator('.season-final-score strong').innerText()).replace(/\s+/g,''),final.points[winner]+'–'+final.points[1-winner]);
      await checkButtons(groups.flat());await checkCards(season);await noOverflow();
      await section.scrollIntoViewIfNeeded();await screenshot(section,label+'-standings-'+season);

      // Enter and Space both activate native strip buttons, but only filter cards.
      const original=await section.innerHTML(),team=groups[0][0];
      await target.locator(`button[data-team-filter="${team}"]`).focus();await target.keyboard.press('Enter');
      assert.equal(await target.locator('#team-filter').inputValue(),team);assert.equal(new URL(target.url()).searchParams.get('team'),team);
      assert.equal(await target.locator(`button[data-team-filter="${team}"]`).getAttribute('aria-pressed'),'true');
      assert.equal(await target.evaluate(()=>document.activeElement?.dataset.teamFilter),team);await checkCards(season,team);
      assert.equal(await section.innerHTML(),original,'team filter must leave whole-season results unchanged');
      await target.selectOption('#stage-filter','regular');await checkCards(season,team,'regular');
      assert.equal(await section.innerHTML(),original,'stage filter must leave whole-season results unchanged');
      await noOverflow();
      const filtered=target.url();
      await section.locator('.season-final-score').click();await readyOn(target,'match',final.id);
      assert.equal(await target.locator('#match-dialog').evaluate(n=>n.open),true,'final result button opens the match modal');
      await target.keyboard.press('Escape');await readyOn(target,'seasons');
      assert.equal(target.url(),filtered);assert.equal(await section.innerHTML(),original);await checkCards(season,team,'regular');
      await target.goForward();await readyOn(target,'match',final.id);await target.locator('#close-dialog').click();await readyOn(target,'seasons');assert.equal(target.url(),filtered);
      const card=target.locator('#season-matches .match-card').first(),id=await card.getAttribute('data-match');
      await card.click();await readyOn(target,'match',id);await target.locator('#close-dialog').click();await readyOn(target,'seasons');assert.equal(target.url(),filtered);
      await section.locator('.season-finalist').first().click();await readyOn(target,'team',final.teams[winner]);
      await target.goBack();await readyOn(target,'seasons');assert.equal(target.url(),filtered);assert.equal(await section.innerHTML(),original);
      await target.locator('button[data-team-filter="all"]').focus();await target.keyboard.press('Space');
      assert.equal(await target.locator('#team-filter').inputValue(),'all');assert.equal(await section.innerHTML(),original);await checkCards(season,'all','regular');
    }

    await openSeason('all');
    const overview=target.locator('.season-results[data-season="all"]');
    assert.equal(await overview.locator('h2').innerText(),'シーズン別の結果');
    assert.equal(await overview.locator('.standings-table').count(),0);
    assert.deepEqual(await overview.locator('.season-winner').evaluateAll(nodes=>nodes.map(n=>n.dataset.season)),['5','4','2','0']);
    await checkButtons(Object.keys(data.teams));await checkCards('all');await noOverflow();await screenshot(overview,label+'-standings-all');
    await overview.locator('button[data-season="2"]').click();await readyOn(target,'seasons');assert.equal(new URL(target.url()).searchParams.get('season'),'2');

    // A season switch is one history step; invalid teams reset immediately.
    for(const [from,team,to,stage] of [['0','WHITE','5','final'],['2','supernova_tohoku','4','regular']]){
      await openSeason(from);await target.locator(`button[data-team-filter="${team}"]`).click();await target.selectOption('#stage-filter',stage);
      const before=target.url();await chooseSeason(to);const after=target.url();
      assert.deepEqual(await filterState(),{season:to,team:'all',stage});assert.equal(new URL(after).searchParams.get('team'),'all');await checkCards(to,'all',stage);
      await target.goBack();await readyOn(target,'seasons');assert.equal(target.url(),before);assert.deepEqual(await filterState(),{season:from,team,stage});
      await target.goForward();await readyOn(target,'seasons');assert.equal(target.url(),after);assert.deepEqual(await filterState(),{season:to,team:'all',stage});
    }

    // Old shared URLs must agree with the rendered controls, canonical/OG metadata
    // and newly copied URLs, including a valid stage unavailable in that season.
    for(const [season,team,stage,normalized] of [['5','WHITE','final',{season:'5',team:'all',stage:'final'}],['4','supernova_tohoku','quarter',{season:'4',team:'all',stage:'all'}]]){
      await target.goto(base+'/bpl/s?'+new URLSearchParams({view:'seasons',season,team,stage}));await readyOn(target,'seasons');
      assert.deepEqual(await filterState(),normalized);
      await target.locator('.share-toolbar [data-share-action="copy"]').click();
      const urls=[target.url(),await target.evaluate(()=>window.__copied),await target.locator('link[rel="canonical"]').getAttribute('href'),await target.locator('meta[property="og:url"]').getAttribute('content'),await target.locator('meta[property="og:image"]').getAttribute('content'),await target.locator('meta[name="twitter:image"]').getAttribute('content')];
      for(const value of urls)for(const [key,expectedValue] of Object.entries(normalized))assert.equal(new URL(value).searchParams.get(key),expectedValue,key+' normalized in '+value);
      await checkCards(normalized.season,normalized.team,normalized.stage);
    }
    await target.goto(base+'/bpl/s?view=s6');await readyOn(target,'s6');
    const pending=target.locator('.season-results[data-season="6"]');
    assert.equal(await pending.locator('h2').innerText(),'S6の順位・成績');
    assert.match(await pending.innerText(),/開幕前/);assert.match(await pending.innerText(),/順位未確定/);assert.equal(await pending.locator('.standings-table').count(),0);
    assert.deepEqual((await pending.locator('.pending-teams a').evaluateAll(nodes=>nodes.map(n=>n.hash.replace('#team/','')))).sort(),[...current].sort());
    await noOverflow();await pending.scrollIntoViewIfNeeded();await screenshot(pending,label+'-standings-6');
    await pending.locator('.pending-teams a').first().click();await readyOn(target,'team');await target.goBack();await readyOn(target,'s6');assert.equal(await pending.count(),1);
  }finally{await ctx.close()}
}
try {
  await checkSeasonStandings('desktop',{width:1280,height:900});
  await checkSeasonStandings('mobile',{width:390,height:844});
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
  await page.locator('button.season-button[data-season="0"]').click();await page.waitForURL(u=>u.searchParams.get('season')==='0');
  await page.selectOption('#team-filter','WHITE');await page.selectOption('#stage-filter','final');
  const zero=page.url();
  await page.locator('button.season-button[data-season="5"]').click();await page.waitForURL(u=>u.searchParams.get('season')==='5');
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

  await checkRoundPoints('desktop',{width:1280,height:900});
  await checkRoundPoints('mobile',{width:390,height:844});
  await checkRoundPoints('narrow',{width:320,height:720});
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

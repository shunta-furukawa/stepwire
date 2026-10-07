/**
 * Real-font BPL nameplate regressions against `pnpm dev` or `pnpm start`:
 *   BASE_URL=http://127.0.0.1:3000 node tests/bpl-nameplates.browser.mjs
 * Uses the runner's installed Playwright/Chromium; never downloads a browser.
 * BPL_SCREENSHOT_OUTPUT joins the existing CI screenshot artifact directory.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const data = JSON.parse(await readFile(new URL('../public/bpl/data.json', import.meta.url), 'utf8'));
const brand = JSON.parse(await readFile(new URL('../public/bpl/brand.json', import.meta.url), 'utf8'));
const teams = Object.fromEntries(Object.entries(data.teams).map(([id, team]) => [id, { ...team, ...brand.teams[id] }]));
const seasonTeams = season => Object.keys(teams).filter(id => data.players.some(player => player.history.some(entry => entry.team === id && entry.season === season)));
const latestSeason = id => Math.max(...data.players.flatMap(player => player.history.filter(entry => entry.team === id).map(entry => entry.season)));
const teamName = (id, season) => season === 6 ? teams[id].currentName || teams[id].name : teams[id].name;
const knownNames = [...new Set(Object.values(teams).flatMap(team => [team.name, team.currentName].filter(Boolean)))];
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const screenshotOutput = process.env.BPL_SCREENSHOT_OUTPUT ? resolve(process.env.BPL_SCREENSHOT_OUTPUT) : null;
if (screenshotOutput) await mkdir(screenshotOutput, { recursive: true });
const errors = [], externalImages = [];
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });

async function ready(page, view, id) {
  await page.waitForFunction(({ view, id }) => {
    const query = new URLSearchParams(location.search);
    return query.get('view') === view && (!id || query.get('id') === id) && !document.querySelector('main .loading') && document.querySelector('main .team-nameplate');
  }, { view, id });
  await page.evaluate(() => document.fonts.ready);
}
async function goto(page, query) {
  await page.goto(base + '/bpl/s?' + new URLSearchParams(query));
  await ready(page, query.view, query.id);
}
async function screenshot(target, name) {
  if (screenshotOutput) await target.screenshot({ path: join(screenshotOutput, name + '.png'), animations: 'disabled' });
}
async function noPageOverflow(page, label) {
  const measurements = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  try {
    assert.ok(measurements.html <= measurements.viewport + 1 && measurements.body <= measurements.viewport + 1,
      label + ': horizontal page overflow ' + JSON.stringify(measurements));
  } catch (error) {
    const layout = await page.evaluate(() => {
      const metrics = node => {
        const box = node.getBoundingClientRect(), style = getComputedStyle(node);
        return {
          tag: node.tagName, id: node.id, className: node.className,
          text: node.textContent.trim().replace(/\s+/g, ' ').slice(0, 120),
          box: { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom },
          clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
          display: style.display, width: style.width, minWidth: style.minWidth, maxWidth: style.maxWidth,
          paddingLeft: style.paddingLeft, paddingRight: style.paddingRight, gap: style.gap,
          overflowX: style.overflowX, gridTemplateColumns: style.gridTemplateColumns,
          tableLayout: style.tableLayout, whiteSpace: style.whiteSpace, fontSize: style.fontSize,
        };
      };
      const collect = selector => [...document.querySelectorAll(selector)].filter(node => node.getClientRects().length).map(metrics);
      return {
        url: location.href, innerWidth, innerHeight, scrollX, scrollY,
        visualViewport: visualViewport ? { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale } : null,
        mainChildren: collect('main > *'), seasonResultChildren: collect('.season-results > *'),
        standingsGroupsAndTables: collect('.standings-group,.standings-table'),
        standingsCells: collect('.standings-table th,.standings-table td,.standing-finish'),
        finalists: collect('.season-finalists > *'), toolbarChildren: collect('.toolbar > *'),
      };
    }).catch(problem => ({ diagnosticError: String(problem) }));
    error.layoutDiagnostics = { label, ...measurements, ...layout };
    error.message += '\nLayout diagnostics: ' + JSON.stringify(error.layoutDiagnostics);
    throw error;
  }
}

// Range rects measure rendered glyph runs, unlike scrollWidth alone (which can
// miss clipped text). These measurements run after actual browser fonts load and
// cover plates outside the viewport too, except closed <details>/<dialog> nodes.
async function checkPlates(page, label, selector = 'main .team-nameplate', expected = []) {
  await page.evaluate(() => document.fonts.ready);
  const plates = await page.locator(selector).evaluateAll(elements => elements.filter(element => {
    const style = getComputedStyle(element);
    return element.getClientRects().length && style.display !== 'none' && style.visibility !== 'hidden';
  }).map(element => {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    const copy = element.querySelector('.nameplate-copy');
    const container = element.closest('.team-card-heading,.team-hero,.player-visual,.s6-team-title,.season-team-filters button,.pending-teams a,.season-finalist,.dialog-score>div,.team-row,.vs-identity,.history-team,.team-name-link,.zero-team,.s6-preview-team');
    const containerBox = container?.getBoundingClientRect();
    const lines = [...element.querySelectorAll('.nameplate-top, .nameplate-main')].map(line => {
      const range = document.createRange();
      range.selectNodeContents(line);
      const rectangles = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
      const textStyle = getComputedStyle(line);
      const family = textStyle.fontFamily.split(',')[0].trim().replace(/["']/g, '');
      return {
        text: line.textContent, className: line.className, font: textStyle.font, family,
        fontLoaded: [...document.fonts].some(face => face.family.replace(/["']/g, '') === family && face.status === 'loaded'),
        textOverflow: textStyle.textOverflow,
        rectangles: rectangles.map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })),
      };
    });
    return {
      name: element.getAttribute('aria-label'), role: element.getAttribute('role'),
      className: element.className, copyHidden: copy?.getAttribute('aria-hidden'),
      main: element.querySelector('.nameplate-main')?.textContent,
      hasArtwork: Boolean(element.querySelector('img,svg,canvas,picture')),
      color: style.getPropertyValue('--team').trim(),
      box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height },
      container: containerBox ? { left: containerBox.left, right: containerBox.right } : null,
      lines,
    };
  }));
  assert.ok(plates.length, label + ': no rendered nameplates in ' + selector);
  for (const plate of plates) {
    const context = label + ': ' + plate.name + ' [' + plate.className + ']';
    assert.ok(knownNames.includes(plate.name), context + ': unknown/truncated accessible name');
    assert.equal(plate.role, 'img', context);
    assert.equal(plate.copyHidden, 'true', context + ': text should not duplicate the accessible label');
    assert.ok(plate.main?.length, context + ': missing visible name');
    assert.equal(plate.lines.map(line => line.text).filter(Boolean).join(' '), plate.name, context + ': visible text must retain the full identity');
    assert.equal(plate.hasArtwork, false, context + ': original text plate must not load team artwork');
    assert.ok(plate.color, context + ': team color was lost');
    assert.ok(plate.box.width > 0 && plate.box.height > 0, context);
    if (plate.container) assert.ok(plate.box.left >= plate.container.left - 1 && plate.box.right <= plate.container.right + 1,
      context + ': plate exceeds its context ' + JSON.stringify({ box: plate.box, container: plate.container }));
    for (const line of plate.lines) {
      if (!line.text) continue;
      assert.ok(['BplTeam', 'BplTeamJapanese'].includes(line.family) && line.fontLoaded, context + ': bundled font was not rendered ' + JSON.stringify(line));
      assert.ok(line.rectangles.length, context + ': invisible text ' + line.text);
      assert.notEqual(line.textOverflow, 'ellipsis', context + ': name must not be truncated');
      for (const rectangle of line.rectangles) {
        assert.ok(rectangle.left >= plate.box.left - 1 && rectangle.right <= plate.box.right + 1,
          context + ': text exceeds plate width ' + JSON.stringify({ line, box: plate.box }));
        assert.ok(rectangle.top >= plate.box.top - 1 && rectangle.bottom <= plate.box.bottom + 1,
          context + ': text exceeds plate height ' + JSON.stringify({ line, box: plate.box }));
      }
    }
  }
  for (const name of expected) assert.ok(plates.some(plate => plate.name === name), label + ': missing ' + name);
  return plates;
}

async function checkViewport(label, viewport) {
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 650, hasTouch: viewport.width < 650, deviceScaleFactor: 1, serviceWorkers: 'block' });
  context.on('request', request => {
    if (request.resourceType() === 'image' && new URL(request.url()).origin !== new URL(base).origin) externalImages.push(request.url());
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(label + ': ' + error.message));
  try {
    // All eight franchise identities and all three ZERO teams are visible on
    // the real team list. Only the current S6 identity uses LEISURELAND.
    await goto(page, { view: 'teams' });
    const listNames = Object.keys(teams).map(id => teamName(id, latestSeason(id)));
    await checkPlates(page, label + ' team cards', 'main .team-nameplate', listNames);
    assert.equal(await page.locator('.team-card .team-nameplate').count(), 8);
    assert.equal(await page.locator('.zero-team .team-nameplate').count(), 3);
    await noPageOverflow(page, label + ' teams');
    await screenshot(page.locator('.teams-grid'), label + '-nameplates-team-grid');
    await screenshot(page.locator('.zero-teams'), label + '-nameplates-zero');

    // Click the plate itself, so decorative layers cannot silently block links.
    // Check every hero, including the longest English and Japanese identities.
    for (const id of Object.keys(teams)) {
      await page.locator(`.team-card[href="#team/${id}"], .zero-team[href="#team/${id}"]`).locator('.team-nameplate').click();
      await ready(page, 'team', id);
      await checkPlates(page, label + ' hero ' + id, '.team-hero .team-nameplate', [teamName(id, latestSeason(id))]);
      await checkPlates(page, label + ' team context ' + id);
      await noPageOverflow(page, label + ' team ' + id);
      await screenshot(page.locator('.team-hero'), label + '-nameplates-hero-' + id.toLowerCase());
      await page.goBack();
      await ready(page, 'teams');
    }

    // Historic names remain exact in team filters, match cards and detail.
    // The selection must still filter the data and survive opening/closing.
    for (const [season, id] of [[5, 'leisure_land'], [2, 'supernova_tohoku'], [0, 'WHITE']]) {
      await goto(page, { view: 'seasons', season: String(season) });
      await checkPlates(page, label + ' season ' + season, '.season-team-filters .team-nameplate', seasonTeams(season).map(team => teamName(team, season)));
      await page.locator(`[data-team-filter="${id}"] .team-nameplate`).click();
      await page.waitForFunction(id => new URLSearchParams(location.search).get('team') === id, id);
      assert.equal(await page.locator(`[data-team-filter="${id}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#team-filter').inputValue(), id);
      assert.equal(await page.locator('.match-card').count(), data.matches.filter(match => match.season === season && match.teams.includes(id)).length);
      await checkPlates(page, label + ' selected ' + id);
      await noPageOverflow(page, label + ' selected ' + id);
      await screenshot(page.locator('.season-team-filters'), label + '-nameplates-filter-s' + season);
      const card = page.locator('.match-card').first(), matchId = await card.getAttribute('data-match');
      const match = data.matches.find(match => match.id === matchId), parentUrl = page.url();
      await screenshot(card, label + '-nameplates-match-s' + season);
      await card.locator('.team-nameplate').first().click();
      await ready(page, 'match', matchId);
      const dialog = page.locator('#match-dialog');
      assert.equal(await dialog.evaluate(element => element.open), true);
      await checkPlates(page, label + ' detail ' + matchId, '#dialog-content .team-nameplate', match.teams.map(team => teamName(team, season)));
      const detailOverflow = await page.locator('#dialog-content').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
      assert.ok(detailOverflow.scroll <= detailOverflow.width + 1, label + ': detail overflow ' + JSON.stringify(detailOverflow));
      await screenshot(dialog, label + '-nameplates-detail-s' + season);
      await page.locator('#close-dialog').click();
      await ready(page, 'seasons');
      assert.equal(page.url(), parentUrl);
      assert.equal(await dialog.evaluate(element => element.open), false);
      await card.locator('.team-nameplate').first().click();
      await ready(page, 'match', matchId);
      await page.goBack();
      await ready(page, 'seasons');
      assert.equal(page.url(), parentUrl);
      assert.equal(await dialog.evaluate(element => element.open), false);
      await page.goForward();
      await ready(page, 'match', matchId);
      assert.equal(await dialog.evaluate(element => element.open), true);
      await page.keyboard.press('Escape');
      await ready(page, 'seasons');
      assert.equal(page.url(), parentUrl);
      assert.equal(await dialog.evaluate(element => element.open), false);
    }

    await goto(page, { view: 's6' });
    const currentNames = seasonTeams(6).map(id => teamName(id, 6));
    await checkPlates(page, label + ' S6 pending', '.pending-teams .team-nameplate', currentNames);
    await checkPlates(page, label + ' S6 rosters', '.s6-team-title .team-nameplate', currentNames);
    await page.selectOption('#s6-a', 'leisure_land');
    await page.selectOption('#s6-b', 'taitostation_tradz');
    await page.waitForFunction(() => new URLSearchParams(location.search).get('previewB') === 'taitostation_tradz');
    await checkPlates(page, label + ' S6 comparison', '.s6-preview-team .team-nameplate', ['LEISURELAND', 'TAITO STATION Tradz']);
    await noPageOverflow(page, label + ' S6');
    await screenshot(page.locator('.pending-teams'), label + '-nameplates-s6-compact');
    await screenshot(page.locator('.s6-preview-score'), label + '-nameplates-s6-comparison');
    await screenshot(page.locator('.s6-rosters'), label + '-nameplates-s6-rosters');
    await page.locator('.pending-teams a[href="#team/leisure_land"] .team-nameplate').click();
    await ready(page, 'team', 'leisure_land');
    await page.goBack();
    await ready(page, 's6');
    assert.equal(await page.locator('#s6-a').inputValue(), 'leisure_land');
    assert.equal(await page.locator('#s6-b').inputValue(), 'taitostation_tradz');

    await goto(page, { view: 'players' });
    await checkPlates(page, label + ' player cards');
    await noPageOverflow(page, label + ' players');
    const leisurePlayer = data.players.find(player => player.history.at(-1).team === 'leisure_land' && player.history.at(-1).season === 6);
    await page.locator(`.player-card[href="#player/${encodeURIComponent(leisurePlayer.id)}"] .team-nameplate`).click();
    await ready(page, 'player', leisurePlayer.id);
    await checkPlates(page, label + ' player hero/history');
    await noPageOverflow(page, label + ' player detail');
    await screenshot(page.locator('.official-player-hero'), label + '-nameplates-player-hero');
    await page.locator('.team-name-link .team-nameplate').click();
    await ready(page, 'team', 'leisure_land');
    await page.goBack();
    await ready(page, 'player', leisurePlayer.id);

    await goto(page, { view: 'versus', a: 'O4MA.', b: leisurePlayer.id });
    await checkPlates(page, label + ' versus identities', '.vs-identity .team-nameplate');
    await noPageOverflow(page, label + ' versus');
    await screenshot(page.locator('.versus-board'), label + '-nameplates-versus');
    console.log('BPL nameplates:', label, 'passed');
  } catch (error) {
    await screenshot(page, label + '-nameplates-failure').catch(() => {});
    if (screenshotOutput && error.layoutDiagnostics) {
      await writeFile(join(screenshotOutput, label + '-nameplates-failure.json'), JSON.stringify(error.layoutDiagnostics, null, 2))
        .catch(problem => console.error('Nameplate overflow diagnostics:', String(problem)));
    }
    throw error;
  } finally {
    await context.close();
  }
}

try {
  for (const [label, viewport] of [
    ['desktop', { width: 1280, height: 900 }],
    ['tablet', { width: 768, height: 1024 }],
    ['breakpoint', { width: 651, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
    ['narrow', { width: 320, height: 740 }],
  ]) await checkViewport(label, viewport);
  assert.deepEqual(errors, [], 'browser runtime errors');
  assert.deepEqual(externalImages, [], 'no remote team artwork should be requested');
} finally {
  await browser.close();
}

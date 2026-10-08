/**
 * Matrix image export regressions against a running `pnpm dev` or `pnpm start`:
 *   BASE_URL=http://127.0.0.1:3000 CHROMIUM_PATH=/usr/bin/chromium node tests/bpl-matrix-export.browser.mjs
 * Uses installed Playwright/Chromium; no packages or browsers are downloaded.
 * Set BPL_SCREENSHOT_OUTPUT to save desktop/mobile previews and original PNGs.
 * Native Web Share is mocked, but its File bytes come from the real image route.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const output = process.env.BPL_SCREENSHOT_OUTPUT ? resolve(process.env.BPL_SCREENSHOT_OUTPUT) : null;
const defaults = { matrixSeason: 'all', matrixFormat: 'all', matrixCategory: 'all', matrixStyle: 'all' };
const teams = { previewA: 'apina_vrames', previewB: 'gigo' };
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });

async function screenshot(page, name) {
  if (output) await page.screenshot({ path: join(output, name + '.png'), animations: 'disabled' });
}

function checkImageUrl(value, filters, pair = teams) {
  const url = new URL(value);
  assert.equal(url.origin, new URL(base).origin);
  assert.equal(url.pathname, '/bpl/og');
  for (const [key, expected] of Object.entries({ view: 'matrix', matrixVersion: '3', hideResults: '1', ...pair, ...filters })) {
    assert.equal(url.searchParams.get(key), expected, `${key} in ${url.href}`);
  }
  assert.equal(url.searchParams.has('matrixA'), false, 'export shares the whole table, not a detail cell');
  assert.equal(url.searchParams.has('matrixB'), false);
  return url;
}

async function checkViewport(label, viewport) {
  const mobile = label === 'mobile';
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const errors = [];
  await context.addInitScript(() => {
    window.__matrixShares = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.__matrixCopied = value; } } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: value => Array.isArray(value.files) && value.files.every(file => file instanceof File && file.type === 'image/png') });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async value => {
      const files = await Promise.all((value.files || []).map(async file => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
        const bitmap = await createImageBitmap(file);
        const result = { name: file.name, type: file.type, size: file.size, signature: [...bytes.slice(0, 8)], width: bitmap.width, height: bitmap.height, hash };
        bitmap.close();
        return result;
      }));
      window.__matrixShares.push({ title: value.title, url: value.url || null, files });
    } });
    // Delay only the optional native-share fetch. The actual <img> still loads
    // normally, so a user can close it and request a newer filtered image.
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const url = new URL(args[0] instanceof Request ? args[0].url : String(args[0]), location.href);
      const hold = window.__delayNextMatrixFetch && url.pathname === '/bpl/og';
      if (hold) window.__delayNextMatrixFetch = false;
      const response = await fetchOriginal(...args);
      if (hold) {
        window.__matrixFetchHeld = true;
        await new Promise(resolve => { window.__releaseMatrixFetch = resolve; });
        const readBlob = response.blob.bind(response);
        response.blob = async () => {
          const blob = await readBlob();
          window.__matrixOldBlobRead = true;
          return blob;
        };
      }
      return response;
    };
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(30_000);
  const preview = page.locator('#share-preview');
  const openButton = page.locator('[data-matrix-share][data-share-action="preview"]');
  const shareButton = page.locator('#share-image-file');
  const hashes = new Map();
  async function ready(filters, pair = teams) {
    await page.waitForFunction(() => document.querySelectorAll('.s6-matrix .matrix-cell').length === 16);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#s6-a').inputValue(), pair.previewA);
    assert.equal(await page.locator('#s6-b').inputValue(), pair.previewB);
    for (const [key, value] of Object.entries(filters)) assert.equal(await page.locator('#' + key).inputValue(), value);
  }
  async function select(filters) {
    for (const [key, value] of Object.entries(filters)) await page.selectOption('#' + key, value);
    await ready(filters);
  }
  async function close() {
    const before = page.url();
    await page.locator('#share-preview-close').click();
    await page.waitForFunction(() => !document.querySelector('#share-preview').open);
    assert.equal(page.url(), before, 'closing image preview must not change the selected comparison');
  }
  async function open(filters, name, pair = teams) {
    await openButton.click();
    await page.waitForFunction(() => {
      const img = document.querySelector('#share-preview-image');
      return document.querySelector('#share-preview').open && img.complete && img.naturalWidth === 1200 && img.naturalHeight === 630;
    });
    const url = checkImageUrl(await page.locator('#share-preview-image').getAttribute('src'), filters, pair);
    assert.equal(await page.locator('#share-image-link').getAttribute('href'), url.href);
    assert.equal(await page.locator('#share-preview-status').textContent(), '');
    const response = await context.request.get(url.href);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /^image\/png/);
    const bytes = await response.body();
    assert.deepEqual([...bytes.subarray(0, 8)], pngSignature);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 630);
    const hash = createHash('sha256').update(bytes).digest('hex');
    hashes.set(name, hash);
    const layout = await preview.evaluate(node => {
      const image = node.querySelector('img'), frame = node.getBoundingClientRect(), box = image.getBoundingClientRect();
      return { width: innerWidth, left: frame.left, right: frame.right, imageWidth: box.width, imageHeight: box.height, imageLeft: box.left, imageRight: box.right };
    });
    assert.ok(layout.left >= -1 && layout.right <= layout.width + 1, `${label}: preview exceeds viewport ${JSON.stringify(layout)}`);
    assert.ok(layout.imageLeft >= layout.left && layout.imageRight <= layout.right + 1, `${label}: image exceeds dialog`);
    assert.ok(Math.abs(layout.imageWidth / layout.imageHeight - 1200 / 630) < 0.01, 'preview retains the PNG aspect ratio');
    await screenshot(page, `${label}-matrix-export-${name}`);
    if (output) await writeFile(join(output, `${label}-matrix-export-${name}-original.png`), bytes);
    return { url, hash, bytes: bytes.length };
  }
  async function share(expected) {
    await shareButton.waitFor({ state: 'visible' });
    const count = await page.evaluate(() => window.__matrixShares.length);
    await shareButton.click();
    await page.waitForFunction(count => window.__matrixShares.length > count, count);
    const result = await page.evaluate(() => window.__matrixShares.at(-1));
    assert.equal(result.title, 'BPL DDR 選手同士の過去対戦');
    assert.equal(result.url, null, 'native image sharing sends a PNG File, not just a page URL');
    assert.equal(result.files.length, 1);
    assert.deepEqual(result.files[0], { name: 'stepwire-bpl-matrix.png', type: 'image/png', size: expected.bytes, signature: pngSignature, width: 1200, height: 630, hash: expected.hash });
  }
  try {
    await page.goto(base + '/bpl/s?' + new URLSearchParams({ view: 'matrix', hideResults: '1', ...teams, ...defaults }));
    await ready(defaults);
    const initial = await open(defaults, 'default');
    await share(initial);
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('#share-image-link').click()]);
    await popup.waitForLoadState('domcontentloaded');
    assert.equal(popup.url(), initial.url.href, 'save opens the exact preview PNG URL');
    await popup.waitForFunction(() => [...document.images].some(img => img.complete && img.naturalWidth === 1200 && img.naturalHeight === 630));
    await popup.close();
    await close();
    const reopened = await open(defaults, 'reopened');
    assert.equal(reopened.hash, initial.hash, 'reopening without changes keeps the same image');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#share-preview').open);

    const filtered = { matrixSeason: '2', matrixFormat: 'tag', matrixCategory: 'GOLD', matrixStyle: 'STANDARD' };
    await select(filtered);
    await page.locator('[data-matrix-share][data-share-action="copy"]').click();
    const restoredUrl = await page.evaluate(() => window.__matrixCopied);
    assert.equal(new URL(restoredUrl).searchParams.get('matrixVersion'), '3');
    await page.goto(restoredUrl);
    await ready(filtered);
    const selected = await open(filtered, 'filtered');
    assert.notEqual(selected.hash, initial.hash, 'selected filters change the exported image');
    await share(selected);
    await close();

    // Make an older share-file fetch finish after a newer preview is ready.
    const older = { ...defaults, matrixCategory: 'WHITE' };
    await select(older);
    await page.evaluate(() => { window.__delayNextMatrixFetch = true; });
    await open(older, 'pending-older');
    await page.waitForFunction(() => window.__matrixFetchHeld === true);
    assert.equal(await shareButton.isVisible(), false, 'old file is not offered while replacement is loading');
    await close();
    const latest = { ...defaults, matrixCategory: 'POPULAR', matrixStyle: 'TRICKY' };
    await select(latest);
    assert.equal(await page.locator('.matrix-cell.has-record').count(), 0, 'empty-filter fixture is genuinely empty');
    const newest = await open(latest, 'latest-empty');
    await share(newest);
    await page.evaluate(() => window.__releaseMatrixFetch());
    await page.waitForFunction(() => window.__matrixOldBlobRead === true);
    await share(newest);
    assert.equal(await page.locator('#share-preview-image').getAttribute('src'), newest.url.href);
    assert.notEqual(newest.hash, hashes.get('pending-older'));
    await close();

    // Team changes also replace the image; punctuation and Japanese names are
    // exercised by the real S6 rosters and the LEISURELAND team selection.
    await select(defaults);
    await page.selectOption('#s6-a', 'round1');
    await page.selectOption('#s6-b', 'leisure_land');
    const changedTeams = { previewA: 'round1', previewB: 'leisure_land' };
    await ready(defaults, changedTeams);
    const changed = await open(defaults, 'changed-teams', changedTeams);
    await share(changed);
    assert.notEqual(changed.hash, initial.hash);
    await close();
    assert.deepEqual(errors, [], `${label}: uncaught browser errors`);
    console.log(`${label}: matrix preview, PNG save, filtered restore, close/reopen, native File bytes, stale-fetch race and team changes passed`);
  } catch (error) {
    await screenshot(page, `${label}-matrix-export-failure`).catch(() => {});
    console.error('Matrix export failure:', label, page.url(), errors);
    throw error;
  } finally {
    await page.evaluate(() => window.__releaseMatrixFetch?.()).catch(() => {});
    await context.close();
  }
}

try {
  await checkViewport('desktop', { width: 1280, height: 900 });
  await checkViewport('mobile', { width: 390, height: 844 });
} finally {
  await browser.close();
}

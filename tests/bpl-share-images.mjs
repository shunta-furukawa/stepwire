/** Check the real server handlers and PNG output, without requiring a browser. */
import assert from 'node:assert/strict';
import React from 'react';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GET as image } from '../app/bpl/og/route.tsx';
import { shareModel } from '../lib/bpl/share.ts';
import { matrixTone } from '../public/bpl/matrix.js';
import { GET as page } from '../app/bpl/s/route.ts';
// tsx runs the repository's preserve-JSX configuration outside the Next compiler.
// Next and production use the automatic JSX runtime instead.
globalThis.React = React;
const data = JSON.parse(await readFile(new URL('../public/bpl/data.json', import.meta.url), 'utf8'));
const brand = JSON.parse(await readFile(new URL('../public/bpl/brand.json', import.meta.url), 'utf8'));
const matrixTeams = Object.keys(data.teams).filter(id => data.players.some(p => p.history.some(h => h.season === 6 && h.team === id)));
const cases = [
  ...data.players.map(p => ({ view: 'player', id: p.id })),
  ...Object.keys(data.teams).map(id => ({ view: 'team', id })),
  { view: 'team', id: 'apina_vrames', rosterSeason: '4' },
  { view: 'match', id: 's5-final-1' },
  ...matrixTeams.flatMap(a => matrixTeams.filter(b => b !== a).map(b => ({view:'matrix', previewA:a, previewB:b}))),
  { view: 'matrix', previewA: 'round1', previewB: 'gigo', matrixCategory:'POPULAR', matrixStyle:'TRICKY' },
  { view: 'matrix', previewA: 'round1', previewB: 'gigo', matrixSeason:'5', matrixFormat:'tag' },
];
const hashes = new Set();
if (process.env.BPL_IMAGE_OUTPUT) await mkdir(process.env.BPL_IMAGE_OUTPUT, { recursive: true });
for (const params of cases) {
  const q = new URLSearchParams(params).toString();
  const html = await page(new Request(`https://stepwire.example/bpl/s?${q}`, { headers: { 'user-agent': 'Twitterbot/1.0' } }));
  assert.equal(html.status, 200, q);
  const markup = await html.text();
  const url = markup.match(/<meta property="og:image" content="([^"]+)"/)?.[1].replaceAll('&amp;', '&');
  assert.ok(url, q);
  const result = await image(new Request(url));
  assert.equal(result.status, 200, q);
  assert.equal(result.headers.get('content-type'), 'image/png', q);
  const bytes = Buffer.from(await result.arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1200, q);
  assert.equal(metadata.height, 630, q);
  assert.ok(bytes.length > 10000, q);
  const hash = createHash('sha256').update(bytes).digest('hex');
  assert.ok(!hashes.has(hash), `Unexpected identical generic card: ${q}`);
  hashes.add(hash);
  if (params.view === 'matrix') {
    assert.equal(new URL(url).searchParams.get('matrixVersion'), '3');
    const model = shareModel(new URLSearchParams(params)).matrix;
    const {data: pixels, info} = await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const rgb = hex => {const raw = hex.slice(1); const full = raw.length === 3 ? [...raw].map(c => c+c).join('') : raw; return full.match(/../g).map(c=>parseInt(c,16));};
    const pixel = (x,y) => [...pixels.subarray((y*info.width+x)*3,(y*info.width+x)*3+3)];
    assert.deepEqual(pixel(37,90),rgb(brand.teams[params.previewA].color), q + ': row identity');
    assert.deepEqual(pixel(609,90),rgb(brand.teams[params.previewB].color), q + ': column identity');
    assert.deepEqual(pixel(218,160),rgb(brand.teams[params.previewB].color), q + ': column axis');
    for (let i=0;i<4;i++) for (let j=0;j<4;j++) {
      assert.deepEqual(pixel(222+j*238,220+i*76),rgb(matrixTone(model.cells[i][j].rate).background), q + ': result tone');
    }
  }
  if (process.env.BPL_IMAGE_OUTPUT) await writeFile(join(process.env.BPL_IMAGE_OUTPUT, `${params.view}-${encodeURIComponent(params.id || [params.previewA,params.previewB,params.matrixCategory,params.matrixFormat].filter(Boolean).join('-'))}${params.rosterSeason || ''}.png`), bytes);
}
console.log(`${cases.length} crawler pages and distinct 1200×630 PNG cards passed (all 40 players, all 11 teams, S4 roster, match, all 42 ordered S6 matrices and filtered matrices; team/result pixels checked)`);

/** Check the real server handlers and PNG output, without requiring a browser. */
import assert from 'node:assert/strict';
import React from 'react';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GET as image } from '../app/bpl/og/route.tsx';
import { GET as page } from '../app/bpl/s/route.ts';
// tsx runs the repository's preserve-JSX configuration outside the Next compiler.
// Next and production use the automatic JSX runtime instead.
globalThis.React = React;
const data = JSON.parse(await readFile(new URL('../public/bpl/data.json', import.meta.url), 'utf8'));
const cases = [
  ...data.players.map(p => ({ view: 'player', id: p.id })),
  ...Object.keys(data.teams).map(id => ({ view: 'team', id })),
  { view: 'team', id: 'apina_vrames', rosterSeason: '4' },
  { view: 'match', id: 's5-final-1' },
  { view: 'matrix', previewA: 'round1', previewB: 'gigo' },
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
  if (process.env.BPL_IMAGE_OUTPUT) await writeFile(join(process.env.BPL_IMAGE_OUTPUT, `${params.view}-${encodeURIComponent(params.id || 'matrix')}${params.rosterSeason || ''}.png`), bytes);
}
console.log(`${cases.length} crawler pages and distinct 1200×630 PNG cards passed (all 40 players, all 11 teams, S4 roster, match, matrix)`);

import { test } from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkBplAssets } from './lib/bpl-asset-policy.mjs';

test('rejects reintroduced local artwork, CDN metadata and archives while retaining result sources', () => {
  const root = mkdtempSync(join(tmpdir(), 'bpl-policy-'));
  try {
    mkdirSync(join(root, 'public/bpl'), { recursive: true });
    mkdirSync(join(root, 'vendor'));
    const brandPath = join(root, 'public/bpl/brand.json');
    writeFileSync(brandPath, JSON.stringify({ teams: { round1: { source: 'https://p.eagate.573.jp/game/bpl/season5/', color: '#d80c18' } } }));
    assert.deepEqual(checkBplAssets(root, {}), []);
    writeFileSync(join(root, 'public/bpl/renamed.webp'), 'image');
    writeFileSync(join(root, 'public/bpl/theme.css'), 'a{background:url(https://eacache.s.konaminet.jp/art.png)}');
    writeFileSync(join(root, 'vendor/bpl-assets.tar.gz.001'), 'archive');
    writeFileSync(brandPath, JSON.stringify({ teams: { round1: { logo: '/art.png' } } }));
    const issues = checkBplAssets(root, {});
    assert.equal(issues.length, 4);
    assert.ok(issues.some(i => i.includes('renamed.webp')));
    assert.ok(issues.some(i => i.includes('unreviewed metadata')));
    assert.ok(issues.some(i => i.includes('legacy artwork reference')));
    assert.ok(issues.some(i => i.includes('legacy artwork bundle')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('allows only exact generated portrait bytes with matching player provenance', () => {
  const root = mkdtempSync(join(tmpdir(), 'bpl-generated-'));
  try {
    mkdirSync(join(root, 'public/bpl/portraits'), { recursive: true });
    const bytes = Buffer.from('generated illustration fixture');
    const src = '/bpl/portraits/o4ma.webp';
    const path = join(root, `public${src}`);
    const brandPath = join(root, 'public/bpl/brand.json');
    writeFileSync(path, bytes);
    writeFileSync(brandPath, JSON.stringify({ players: { 'O4MA.': { illustration: src } } }));
    const record = {
      src,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      referenceSha256: createHash('sha256').update('source photograph fixture').digest('hex'),
      sourceUrl: 'https://p.eagate.573.jp/game/bpl/season4/ddr/team/round1/01/index.html',
      generationMethod: 'OpenAI built-in imagegen',
      rightsStatus: 'reference-based; likeness and other rights not cleared',
    };
    const inventory = { portraits: { 'O4MA.': record } };
    assert.deepEqual(checkBplAssets(root, {}, inventory), []);
    assert.ok(checkBplAssets(root, {}).some(i => i.includes('missing generated provenance')));
    writeFileSync(path, 'replacement photograph');
    assert.ok(checkBplAssets(root, {}, inventory).some(i => i.includes('bytes changed')));
    writeFileSync(path, bytes);
    assert.ok(checkBplAssets(root, {}, { portraits: { 'O4MA.': { ...record, referenceSha256: record.sha256 } } }).some(i => i.includes('reference photograph cannot be served')));
    const otherSrc = '/bpl/portraits/other.webp';
    const otherBytes = Buffer.from('another generated illustration fixture');
    writeFileSync(join(root, `public${otherSrc}`), otherBytes);
    writeFileSync(brandPath, JSON.stringify({ players: { 'O4MA.': { illustration: src }, OTHER: { illustration: otherSrc } } }));
    const crossPlayerInventory = { portraits: { 'O4MA.': record, OTHER: { ...record, src: otherSrc, sha256: createHash('sha256').update(otherBytes).digest('hex'), referenceSha256: record.sha256 } } };
    assert.ok(checkBplAssets(root, {}, crossPlayerInventory).some(i => i.includes('generated.portraits.O4MA.: reference photograph cannot be served')));
    rmSync(join(root, `public${otherSrc}`));
    writeFileSync(brandPath, JSON.stringify({ players: { 'O4MA.': { illustration: 'https://example.com/photo.webp' } } }));
    assert.ok(checkBplAssets(root, {}, inventory).some(i => i.includes('mapping mismatch')));
    writeFileSync(brandPath, JSON.stringify({ players: { 'O4MA.': { illustration: src } } }));
    rmSync(path);
    assert.ok(checkBplAssets(root, {}, inventory).some(i => i.includes('portrait missing')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

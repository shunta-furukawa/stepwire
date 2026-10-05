import { test } from 'node:test';
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

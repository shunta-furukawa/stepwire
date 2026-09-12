import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_LIMITS, articleAssets, validateAssets } from '../lib/content/assets';
import { parseArticle } from '../lib/content/article';

const ARTICLE = `---
id: x
slug: x
title: X
category: CULTURE
publishedAt: 2026-09-01T00:00:00+09:00
summary: x
status: draft
heroImage:
  src: images/articles/x/hero.jpg
  alt: hero
media:
  - src: images/articles/x/result.webp
    alt: result
    credit: MONO DDR
bgm:
  src: audio/bgm/track.mp3
  credit: 'Someone · CC BY 4.0'
---

## NEWS

x

## CONTEXT

x

## PLAYER IMPACT

x
`;

function publicDir(files: Record<string, number>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'stepwire-assets-'));
  for (const [file, size] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), Buffer.alloc(size));
  }
  return dir;
}

describe('articleAssets', () => {
  it('lists every file the frontmatter points at, without a leading slash', () => {
    const article = parseArticle(ARTICLE, { filePath: 'x' });
    expect(articleAssets(article)).toEqual([
      { kind: 'image', src: 'images/articles/x/hero.jpg', field: 'heroImage' },
      { kind: 'image', src: 'images/articles/x/result.webp', field: 'media[0]' },
      { kind: 'bgm', src: 'audio/bgm/track.mp3', field: 'bgm' },
    ]);
  });
});

describe('validateAssets', () => {
  const article = parseArticle(ARTICLE, { filePath: 'x' });

  it('passes when every file exists within its ceiling', () => {
    const dir = publicDir({
      'images/articles/x/hero.jpg': 1000,
      'images/articles/x/result.webp': ASSET_LIMITS.image,
      'audio/bgm/track.mp3': ASSET_LIMITS.bgm,
    });
    expect(validateAssets([article], dir)).toEqual([]);
  });

  it('refuses a missing file', () => {
    const dir = publicDir({
      'images/articles/x/hero.jpg': 1000,
      'audio/bgm/track.mp3': 1000,
    });
    const issues = validateAssets([article], dir);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('error');
    expect(issues[0]?.message).toContain('media[0]');
    expect(issues[0]?.message).toContain('not in public/');
  });

  it('refuses a picture or a track over its ceiling, naming the size', () => {
    const dir = publicDir({
      'images/articles/x/hero.jpg': ASSET_LIMITS.image + 1,
      'images/articles/x/result.webp': 1000,
      'audio/bgm/track.mp3': ASSET_LIMITS.bgm + 1,
    });
    const messages = validateAssets([article], dir).map((issue) => issue.message);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('heroImage');
    expect(messages[0]).toContain('400 KB');
    expect(messages[1]).toContain('bgm');
    expect(messages[1]).toContain('8.0 MB');
  });
});

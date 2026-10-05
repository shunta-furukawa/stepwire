import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import data from '../public/bpl/data.json';
import brand from '../public/bpl/brand.json';
import inventory from '../docs/bpl-generated-portraits.json';

const script = readFileSync('public/bpl/app.js', 'utf8');
const start = script.indexOf('function portrait(');
const end = script.indexOf('\nfunction playerIdentity(', start);
const portraitFunction = script.slice(start, end);
const render = (illustration?: string, cls = '') => vm.runInNewContext(
  `${portraitFunction};portrait('TEST',cls)`,
  { B: { players: { TEST: { illustration } } }, cls, esc: (s: string) => s, viewIcon: () => '<svg></svg>' },
) as string;

describe('BPL generated player portraits', () => {
  it('has one individually mapped generated portrait for every archive player', () => {
    const portraits = inventory.portraits as Record<string, { src: string; sha256: string; referenceSha256: string }>;
    const players = brand.players as Record<string, { illustration?: string }>;
    expect(Object.keys(portraits).sort()).toEqual(data.players.map(p => p.id).sort());
    expect(new Set(Object.values(portraits).map(p => p.src)).size).toBe(data.players.length);
    expect(new Set(Object.values(portraits).map(p => p.sha256)).size).toBe(data.players.length);
    for (const [id, record] of Object.entries(portraits)) {
      expect(players[id]?.illustration).toBe(record.src);
      expect(record.src).toMatch(/^\/bpl\/portraits\/[a-z0-9-]+\.webp$/);
      const bytes = readFileSync(`public${record.src}`);
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(record.sha256);
      expect(record.sha256).not.toBe(record.referenceSha256);
    }
  });
  it('renders local illustrations without duplicating adjacent player names for screen readers', () => {
    const html = render('/bpl/portraits/test.webp');
    expect(html).toContain('illustrated-portrait');
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('loading="lazy"');
    expect(render('/bpl/portraits/test.webp', 'hero-portrait')).toContain('loading="eager"');
  });
  it('keeps a generic fallback for absent or nonlocal portrait paths', () => {
    for (const src of [undefined, 'https://example.com/photo.webp', '/bpl/portraits/../photo.webp']) {
      expect(render(src)).toContain('player-symbol');
      expect(render(src)).not.toContain('<img');
    }
  });
});

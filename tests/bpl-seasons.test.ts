import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import artwork from '../docs/bpl-original-seasons.json';

const script = readFileSync('public/bpl/seasons.js', 'utf8');
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
const ctx = vm.createContext({ esc, seasonLabel: (n: unknown) => Number(n) === 0 ? 'ZERO' : `S${n}` });
vm.runInContext(`${script};this.api={seasonLogo,seasonRail,seasonDesigns};`, ctx);
const api = ctx.api as {
  seasonLogo: (season: number | string, cls?: string, variant?: string) => string;
  seasonRail: (selected?: number | string) => string;
  seasonDesigns: Record<string, { color: string }>;
};

describe('original BPL season identity', () => {
  it('serves the exact inventoried original SVGs without external artwork or font dependencies', () => {
    expect(Object.keys(artwork.assets)).toHaveLength(10);
    for (const [path, hash] of Object.entries(artwork.assets)) {
      expect(path).toMatch(/^public\/bpl\/seasons\/(zero|s[2456])-(art|badge)\.svg$/);
      const bytes = readFileSync(path);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
      expect(bytes.toString()).not.toMatch(/<text\b|<image\b|<script\b|(?:href|src)=/);
      expect(bytes.toString()).toContain(path.endsWith('-art.svg') ? 'viewBox="0 0 220 116"' : 'viewBox="0 0 65 28"');
    }
  });

  it('uses a unique color and two accessible image sizes for each supported season', () => {
    expect(new Set(Object.values(api.seasonDesigns).map(design => design.color)).size).toBe(5);
    for (const n of [0, 2, 4, 5, 6]) {
      const file = n === 0 ? 'zero' : `s${n}`;
      expect(api.seasonLogo(n)).toContain(`/bpl/seasons/${file}-badge.svg`);
      expect(api.seasonLogo(n)).toContain('width="65" height="28"');
      expect(api.seasonLogo(n)).toContain(`alt="${n === 0 ? 'ZERO エキシビション' : `S${n}`}"`);
      expect(api.seasonLogo(n, 'custom', 'art')).toContain(`/bpl/seasons/${file}-art.svg`);
      expect(api.seasonLogo(n, 'custom', 'art')).toContain('width="220" height="116"');
    }
    expect(api.seasonLogo('<invalid>')).toContain('S&lt;invalid&gt;');
    expect(api.seasonLogo('__proto__')).not.toContain('<img');
    expect(api.seasonLogo(6, '" onclick="bad')).not.toContain(' onclick="bad');
  });

  it('separates the archive filter from all five tickets and links S6 to its guide', () => {
    const all = api.seasonRail();
    expect((all.match(/class="season-button /g) ?? [])).toHaveLength(5);
    expect(all).toContain('data-season="all" aria-pressed="true"');
    expect(all).not.toContain('data-season="6"');
    expect(all).toContain('href="#s6"');
    expect(all).toContain('2026 開幕');
    expect(all).toContain('エキシビション');
    expect(all).not.toContain('season-check');
    const s4 = api.seasonRail('4');
    expect(s4).toContain('data-season="4" aria-pressed="true"');
    expect((s4.match(/class="season-check"/g) ?? [])).toHaveLength(1);
    expect(api.seasonRail(6)).toContain('href="#s6" aria-current="page"');
  });

  it('loads the renderer before consumers and keeps the shared masthead exactly half width', () => {
    const html = readFileSync('public/bpl/index.html', 'utf8');
    expect(html.indexOf('/bpl/seasons.js')).toBeLessThan(html.indexOf('/bpl/s6.js'));
    expect(html.indexOf('/bpl/seasons.js')).toBeLessThan(html.indexOf('/bpl/app.js'));
    const css = readFileSync('public/brand/site.css', 'utf8');
    expect(css).toContain('width:clamp(102.5px,16vw,190px);height:auto');
    expect(css).toContain('width:min(50%,155px)');
  });
});

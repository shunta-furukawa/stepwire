import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { MatrixCard, matrixFontFamily } from '../lib/bpl/matrix-card';
import { shareModel } from '../lib/bpl/share';
import data from '../public/bpl/data.json';
import brand from '../public/bpl/brand.json';
import { matrixTone } from '../public/bpl/matrix.js';

const model = (a = 'round1', b = 'gigo') => shareModel(new URLSearchParams({ view: 'matrix', previewA: a, previewB: b }));
const render = (m = model()) => renderToStaticMarkup(createElement(MatrixCard, { model: m }));

describe('past-player matrix image design', () => {
  it('has no wordmark or display font, with normal and bold sans plus the site team face', () => {
    const html = render();
    expect(html).not.toMatch(/<img|STEPWIRE|Dela|font-family:Bpl;/);
    expect(html).toContain(`font-family:${matrixFontFamily}`);
    expect(html).toContain('font-family:BplTeam');
    expect(html).toContain('font-weight:400');
    expect(html).toContain('font-weight:700');
    expect(html).toContain('選手同士の過去対戦');
  });
  it('keeps every S6 name and current team name, including long names and punctuation', () => {
    const ids = Object.keys(data.teams).filter(id => data.players.some(p => p.history.some(h => h.season === 6 && h.team === id)));
    const palette: Record<string, { color: string; currentName?: string }> = brand.teams;
    const teams: Record<string, { name: string }> = data.teams;
    for (const a of ids) for (const b of ids.filter(id => id !== a)) {
      const m = model(a, b), html = render(m);
      expect(html).toContain(palette[a]!.currentName || teams[a]!.name);
      expect(html).toContain(palette[b]!.currentName || teams[b]!.name);
      for (const player of [...m.matrix!.left, ...m.matrix!.right]) expect(html).toContain(player.name);
      expect(html).toContain(`border-left:5px solid ${palette[a]!.color}`);
      expect(html).toContain(`border-top:4px solid ${palette[b]!.color}`);
      expect(m.matrix!.cells.flat()).toHaveLength(16);
    }
  });
  it('separates team identity from result tones, including five-way and no-result cases', () => {
    const m = model();
    m.matrix!.cells[0] = [
      { w: 2, d: 1, l: 0, n: 3, rate: 100 },
      { w: 1, d: 1, l: 1, n: 3, rate: 50 },
      { w: 0, d: 1, l: 2, n: 3, rate: 0 },
      { w: 0, d: 3, l: 0, n: 3, rate: null },
    ];
    m.matrix!.cells[1]![0] = { w: 0, d: 0, l: 0, n: 0, rate: null };
    const html = render(m);
    for (const rate of [null, 0, 50, 100]) {
      expect(html).toContain(`background:${matrixTone(rate).background}`);
      expect(html).toContain(`color:${matrixTone(rate).color}`);
    }
    expect(html).toContain('0勝 3分 0敗 · 3曲');
    expect(html).toContain('該当記録なし · 0曲');
    expect(html).toContain('見出しの色：所属チーム');
    expect(html).toContain('引分除外');
    expect(html).toContain('Duoは個人EX SCORE比較');
  });
  it('version-busts all matrix share paths while retaining the other card branches', () => {
    expect(model().params.get('matrixVersion')).toBe('3');
    for (const file of ['public/bpl/app.js', 'public/bpl/routing.js']) {
      expect(readFileSync(file, 'utf8')).toContain("p.set('matrixVersion','3')");
    }
    const route = readFileSync('app/bpl/og/route.tsx', 'utf8');
    expect(route.indexOf('if(m.matrix)')).toBeLessThan(route.indexOf("public/brand/wordmark.svg"));
    expect(route).toContain('<EntityCard');
    expect(route).toContain('alt="STEPWIRE"');
    for (const file of ['BplMatrixSans-Regular.ttf', 'BplMatrixSans-Bold.ttf', 'BplMatrixJapanese-Regular.otf', 'BplMatrixJapanese-Bold.otf']) {
      expect(readFileSync('public/fonts/' + file).byteLength).toBeGreaterThan(10000);
    }
  });
});

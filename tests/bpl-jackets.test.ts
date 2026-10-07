import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import * as jackets from '../public/bpl/jackets.js';
import * as nameplates from '../public/bpl/nameplates.js';
import * as standings from '../public/bpl/standings.js';
import palettes from '../public/bpl/jacket-colors.json';
import provenance from '../docs/bpl-jacket-palettes.json';
import data from '../public/bpl/data.json';
import brand from '../public/bpl/brand.json';
import * as routing from '../public/bpl/routing.js';

const completed = ['3y3s', 'Bad Maniacs', 'Fly Like You', 'Ganymede -re:born-', 'Thunderstorm', 'コメット⇒スケイター', '恋歌疾風！かるたクイーンいろは'];
const quadrants = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
type Palette = { id?: string } & Record<typeof quadrants[number], string>;
const songs = palettes.songs as Record<string, Palette>;
const script = readFileSync('public/bpl/app.js', 'utf8');
const css = ['style.css', 'theme.css'].map(name => readFileSync('public/bpl/' + name, 'utf8')).join('\n');
const bootStart = script.indexOf('Promise.all([...[');
const bootEnd = script.indexOf('// Share URLs carry', bootStart);
const testPalette = { topLeft: '#AABBCC', topRight: '#123456', bottomLeft: '#789ABC', bottomRight: '#DEF012' };

// Run the shipped card, detail and versus renderers, with only DOM operations
// adapted. Palette markup is never substituted with a test renderer.
function renderHarness(colors: unknown = palettes, module: unknown = jackets) {
  class Node {
    innerHTML = ''; textContent = ''; value = ''; hidden = false; open = false; scrollTop = 0;
    className = ''; content = ''; style = {}; dataset = {};
    addEventListener() {} querySelector() { return null; } after() {}
    showModal() { this.open = true; }
  }
  const nodes = new Map<string, Node>();
  function get(selector: string) {
    if (!nodes.has(selector)) nodes.set(selector, new Node());
    return nodes.get(selector)!;
  }
  const ctx = vm.createContext({
    URL, URLSearchParams,
    document: { querySelector: get, getElementById: (id: string) => get('#' + id), querySelectorAll: () => [], createElement: () => new Node(), addEventListener() {}, body: { style: {} } },
    window: { addEventListener() {} },
    allArchiveMatches: data.matches, s6SessionPrefs: { hideResults: true },
    inputStandings:standings,inputData: structuredClone(data), inputBrand: structuredClone(brand), inputColors: colors, inputJackets: module, inputNameplates: nameplates, inputFilters: routing.defaultFilters,
  });
  vm.runInContext(readFileSync('public/bpl/seasons.js', 'utf8') + '\n' + script.slice(0, bootStart) + script.slice(bootEnd), ctx);
  vm.runInContext('Standings=inputStandings;D=inputData;B=inputBrand;Jackets=inputJackets;Nameplates=inputNameplates;JacketColors=inputColors;Object.assign(state,inputFilters);for(const [id,t] of Object.entries(B.teams))Object.assign(D.teams[id],t)', ctx);
  return { run: (code: string) => vm.runInContext(code, ctx), get };
}

describe('BPL approved four-color jacket dataset', () => {
  it('has exactly the approved 213 palettes without changing the existing 206, with stable unique IDs', () => {
    expect(palettes.version).toBe(1);
    expect(palettes.quadrants).toEqual(quadrants);
    expect(jackets.QUADRANTS).toEqual(quadrants);
    expect(Object.isFrozen(jackets.QUADRANTS)).toBe(true);
    const archiveTitles = new Set(data.matches.flatMap(m => m.battles.flatMap(b => b.songs.map(s => s.name))));
    expect(archiveTitles.size).toBe(213);
    expect(Object.keys(songs)).toHaveLength(213);
    expect([...archiveTitles].filter(name => !Object.hasOwn(songs, name)).sort()).toEqual([]);
    const ids = new Set<string>();
    for (const [name, palette] of Object.entries(songs)) {
      expect(archiveTitles.has(name), name).toBe(true);
      expect(Object.keys(palette).sort(), name).toEqual(['id', ...quadrants].sort());
      expect(jackets.validPalette(palette), name).toBe(true);
      const id = 'ddr-' + createHash('sha256').update(name).digest('hex').slice(0, 12);
      expect(palette.id, name).toBe(id);
      expect(ids.has(id), name).toBe(false);
      ids.add(id);
    }
    // Lock the approved title/ID/color mapping without depending on JSON whitespace.
    const approved = Object.keys(songs).filter(name => !completed.includes(name)).sort().map(name => [name, ...['id', ...quadrants].map(key => songs[name]![key as keyof Palette])]);
    expect(createHash('sha256').update(JSON.stringify(approved)).digest('hex')).toBe('5c2ca89f8200b1c80516e6bdabc8fe55edc4b1f6fba16319206cbdb464fef729');
    expect(JSON.stringify(palettes)).not.toMatch(/https?:|data:|base64|<img|url\(/i);
  });

  it('retains the exact approved moderate comparison palettes and matching provenance', () => {
    const approved = {
      'Wuv U': ['#faf1dd', '#31adc7', '#bb72af', '#eb5796'],
      'ALPACORE': ['#26cbee', '#26cdf5', '#ffffff', '#1dcdf6'],
      'CHAOS': ['#873216', '#983410', '#772931', '#5b1816'],
      'ビューティフル レシート': ['#42e0cc', '#71f377', '#76e840', '#ebef29'],
      '888': ['#030303', '#020303', '#636179', '#472835'],
      '50th Memorial Songs -The BEMANI History-': ['#b2071a', '#b30417', '#b40517', '#b30316'],
      'MAX 300': ['#be4734', '#b7371d', '#cc3d53', '#d7323f'],
    };
    for (const [title, colors] of Object.entries(approved)) {
      expect(quadrants.map(key => songs[title]![key]), title).toEqual(colors);
    }
    expect(Object.keys(provenance.songs).sort()).toEqual(Object.keys(songs).sort());
    expect(provenance.coverage).toEqual({ totalSongs: 213, sampledSongs: 213, unresolved: [] });
    expect(provenance.paletteFile).toBe('/bpl/jacket-colors.json');
    expect(createHash('sha256').update(readFileSync('public/bpl/jacket-colors.json')).digest('hex')).toBe(provenance.paletteSha256);
    // Source associations, hashes and dimensions must match the original 206-source inventory.
    const sourceFields = ['name', 'sourcePage', 'sourceImage', 'sourceTitle', 'imageSha256', 'sourceDimensions'] as const;
    const sources = Object.entries(provenance.songs).filter(([name]) => !completed.includes(name)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, source]) => [name, ...sourceFields.map(key => source[key])]);
    expect(createHash('sha256').update(JSON.stringify(sources)).digest('hex')).toBe('1db640575990424f593658bd62afcd6f1b515bf3304469ece063700c2731f17d');
    expect(provenance.algorithm).toBe('oklab-moderate-quadrants-v2');
    expect(provenance.selector).toEqual({
      areaExponent: 0.7, chromaWeight: 2, chromaExponent: 2, chromaReference: 0.1,
      minimumClusterFraction: 0.05, neutralFallbackChroma: 0.06,
      fallback: 'oklab-dominant-quadrants-v1', darkLightnessThreshold: 0.18,
      darkAreaThreshold: 0.65, darkMultiplier: 0.7,
      tieBreak: 'stable descending cluster fraction, then first maximum',
    });
  });

  it('adds the seven verified third-party reference palettes with explicit provenance', () => {
    const expected = {
      "3y3s": [
            "#701f42",
            "#7f2752",
            "#4e1230",
            "#501033"
      ],
      "Bad Maniacs": [
            "#d4df90",
            "#ef1b24",
            "#d30525",
            "#d81626"
      ],
      "Fly Like You": [
            "#e9989e",
            "#d57b86",
            "#87c5dc",
            "#eff5f3"
      ],
      "Ganymede -re:born-": [
            "#e5ecea",
            "#42554f",
            "#1b1d1a",
            "#748272"
      ],
      "Thunderstorm": [
            "#5f5b95",
            "#554e86",
            "#12101a",
            "#404770"
      ],
      "コメット⇒スケイター": [
            "#5e44b3",
            "#35468e",
            "#bd78d3",
            "#a588c7"
      ],
      "恋歌疾風！かるたクイーンいろは": [
            "#fc5e8d",
            "#f86ab1",
            "#f56195",
            "#eb669c"
      ]
};
    expect(Object.keys(expected).sort()).toEqual([...completed].sort());
    for (const [title, colors] of Object.entries(expected)) {
      expect(quadrants.map(key => songs[title]![key]), title).toEqual(colors);
      const source = provenance.songs[title as keyof typeof provenance.songs];
      expect(source).toMatchObject({ sourceProvider: '三倍 Ice Cream / 3icecream.com', sourceType: 'third-party reference' });
      expect(new URL(source.sourcePage).hostname).toBe('3icecream.com');
      expect(new URL(source.sourceImage).hostname).toBe('3icecream.com');
      expect(source.sourceTitle).toBe(title);
      expect(source.imageSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.sourceDimensions.every(dimension => dimension >= 512)).toBe(true);
    }
    // Lock each third-party title, artist and exact image association, too.
    const sourceFields = ['name', 'sourcePage', 'sourceImage', 'sourceTitle', 'sourceArtist', 'sourceType', 'sourceProvider', 'imageSha256', 'sourceDimensions'];
    const sources = Object.entries(provenance.songs).filter(([name]) => completed.includes(name)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([name, source]) => [name, ...sourceFields.map(key => (source as Record<string, unknown>)[key])]);
    expect(createHash('sha256').update(JSON.stringify(sources)).digest('hex')).toBe('c601400460deac05f549dec32acd3912b6c0bcf2980647791332a07057cadb32');
    expect(provenance.completion).toMatchObject({ addedSongs: 7, addedQuadrants: 28, unchangedExistingSongs: 206, unchangedExistingQuadrants: 824, thirdPartyReferenceSongs: 7 });
    expect(script).toContain('全213曲に4色の配色を用いています。');
    expect(script).toContain('第三者サイト「三倍 Ice Cream」');
  });

  it('keeps top-left, top-right, bottom-left, bottom-right in that order', () => {
    expect(jackets.gradientVariables(testPalette)).toBe('--jacket-tl:#aabbcc;--jacket-tr:#123456;--jacket-bl:#789abc;--jacket-br:#def012');
  });

  it.each([null, undefined, [], {}, 'red', Object.create(testPalette)])('rejects absent, malformed and inherited palettes: %s', value => {
    expect(jackets.validPalette(value)).toBe(false);
    expect(jackets.gradientVariables(value)).toBe('');
  });

  it.each(['#fff', '#12345678', 'red', 'var(--text)', 'url(https://example.com/art)', '#123456;background:url(https://example.com/art)', '#123456" onclick="alert(1)', '#123456\n', 123456, null])('rejects unsafe color values in every quadrant: %s', color => {
    for (const quadrant of quadrants) {
      const palette = { ...testPalette, [quadrant]: color };
      expect(jackets.validPalette(palette)).toBe(false);
      expect(jackets.gradientVariables(palette)).toBe('');
      expect(jackets.jacketMarkup('Song', { songs: { Song: palette } })).toBe('<span class="music-jacket music-symbol " aria-hidden="true">♪</span>');
    }
  });

  it('requires an exact own-property title and never injects titles, IDs or size classes', () => {
    expect(jackets.paletteForTitle({ songs: Object.create({ Song: testPalette }) }, 'Song')).toBeNull();
    for (const title of ['__proto__', 'constructor', 'ALPACORE ', '<img src=x onerror=alert(1)>']) {
      expect(jackets.paletteForTitle(palettes, title)).toBeNull();
      expect(jackets.jacketMarkup(title, palettes)).not.toContain(title);
    }
    const malicious = '" onclick="alert(1)';
    const html = jackets.jacketMarkup(malicious, { songs: { [malicious]: { ...testPalette, id: malicious } } }, malicious);
    expect(html).toContain('music-gradient');
    expect(html).not.toMatch(/onclick|<img|https?:|url\(/i);
    expect(jackets.paletteForTitle(palettes, 'Cosy Catastrophe')).toBe(songs['Cosy Catastrophe']);
  });

  it('uses empty decorative spans for gradients, retaining the existing size classes and ♪ fallback', () => {
    for (const size of ['', 'mini-jacket', 'duel-jacket']) {
      const html = jackets.jacketMarkup('Cosy Catastrophe', palettes, size);
      expect(html).toContain(`class="music-jacket music-gradient ${size}"`);
      expect(html).toContain('aria-hidden="true"></span>');
      expect(html).not.toMatch(/♪|<img|role=|aria-label=|title=|https?:|url\(/i);
      for (const name of completed) expect(jackets.jacketMarkup(name, palettes, size)).toContain('music-gradient');
      expect(jackets.jacketMarkup('Unknown song', palettes, size)).toBe(`<span class="music-jacket music-symbol ${size}" aria-hidden="true">♪</span>`);
    }
  });

  it('adds only four local CSS corner gradients without changing dimensions or typography', () => {
    const rules = [...css.matchAll(/[^{}]*\.music-gradient[^{}]*\{([^{}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    const declarations = rules.map(match => match[1]).join(';');
    expect((declarations.match(/radial-gradient\(/g) ?? [])).toHaveLength(3);
    const background = declarations.match(/background:\s*([^;]+);/)?.[1]?.replace(/\s+/g, ' ').trim();
    expect(background).toBe('radial-gradient(ellipse at left top, var(--jacket-tl) 0%, transparent 72%), radial-gradient(ellipse at right top, var(--jacket-tr) 0%, transparent 72%), radial-gradient(ellipse at left bottom, var(--jacket-bl) 0%, transparent 72%), var(--jacket-br)');
    for (const [corner, variable] of [['left top', 'tl'], ['right top', 'tr'], ['left bottom', 'bl']]) {
      expect(declarations).toContain(`radial-gradient(ellipse at ${corner}, var(--jacket-${variable}) 0%, transparent 72%)`);
    }
    expect(declarations).toMatch(/,\s*var\(--jacket-br\)\s*;/);
    expect(declarations).not.toMatch(/(?:^|;)\s*(?:width|height|min-width|min-height|max-width|max-height|font(?:-[a-z-]+)?|line-height|letter-spacing)\s*:/i);
    expect(declarations).not.toMatch(/url\(|(?:https?|data):|linear-gradient\(/i);
  });
});

describe('BPL shipped jacket rendering and optional-resource resilience', () => {
  it('renders approved palettes in actual match cards, match details and versus rows', () => {
    const h = renderHarness();
    h.run('seasonPage()');
    const cards = h.get('main').innerHTML;
    expect(cards).toContain(jackets.jacketMarkup('Cosy Catastrophe', palettes, 'mini-jacket'));
    expect(cards.match(/class="music-jacket music-gradient mini-jacket"/g)?.length).toBeGreaterThan(200);
    for (const name of completed) expect(cards).toContain(jackets.jacketMarkup(name, palettes, 'mini-jacket'));
    const match = data.matches.find(m => m.battles.some(b => b.songs.some(s => s.name === 'Cosy Catastrophe')))!;
    h.run(`renderMatch(${JSON.stringify(match.id)})`);
    expect(h.get('#dialog-content').innerHTML).toContain(jackets.jacketMarkup('Cosy Catastrophe', palettes));
    expect(h.get('#match-dialog').open).toBe(true);
    h.run('Object.assign(state,{a:"HIBIKI",b:"NOTTY",vsSeason:"5",vsFormat:"all"});versusPage()');
    expect(h.get('#vs-results').innerHTML).toContain(jackets.jacketMarkup('Cosy Catastrophe', palettes, 'duel-jacket'));
    expect(h.get('#vs-results').innerHTML).toContain('Cosy Catastrophe');
  });

  it.each(['palette', 'module'])('retains all three renderers when the optional %s is unavailable', resource => {
    const h = renderHarness(resource === 'palette' ? null : palettes, resource === 'module' ? null : jackets);
    h.run('seasonPage()');
    expect(h.get('main').innerHTML).toContain('music-symbol mini-jacket');
    expect(h.get('main').innerHTML).not.toContain('music-gradient');
    const match = data.matches.find(m => m.battles.some(b => b.songs.length))!;
    h.run(`renderMatch(${JSON.stringify(match.id)})`);
    expect(h.get('#dialog-content').innerHTML).toContain('music-symbol');
    h.run('Object.assign(state,{a:"HIBIKI",b:"NOTTY",vsSeason:"5",vsFormat:"all"});versusPage()');
    expect(h.get('#vs-results').innerHTML).toContain('music-symbol duel-jacket');
  });

  it.each(['none', 'palette-network', 'palette-status', 'palette-json', 'module', 'both'])('initializes archive navigation and sharing despite optional resource failure: %s', async failure => {
    const calls: string[] = [];
    const main = { innerHTML: '' };
    const ctx = vm.createContext({
      D: undefined, B: undefined, Matrix: undefined, Routing: undefined, Jackets: undefined, JacketColors: undefined, Nameplates: undefined, main,
      fetch: async (path: string) => {
        if (path.endsWith('jacket-colors.json')) {
          if (['palette-network', 'both'].includes(failure)) throw new Error('offline');
          return { ok: failure !== 'palette-status', json: async () => {
            if (failure === 'palette-json') throw new SyntaxError('bad JSON');
            return palettes;
          } };
        }
        return { ok: true, json: async () => path.endsWith('data.json') ? structuredClone(data) : path.endsWith('brand.json') ? structuredClone(brand) : {} };
      },
      testImport: async (path: string) => {
        if (path.endsWith('nameplates.js')) return nameplates;
        if (path.endsWith('jackets.js')) {
          if (['module', 'both'].includes(failure)) throw new Error('module unavailable');
          return jackets;
        }
        return {};
      },
      initS6: () => calls.push('s6'), setupNavigation: () => calls.push('navigation'), initSharing: () => calls.push('sharing'), route: () => calls.push('route'),
    });
    // Native dynamic imports are replaced at the test transport boundary. The
    // application's real Promise.all, optional catches and startup stay intact.
    const startup = script.slice(bootStart, bootEnd).replace(/import\('([^']+)'\)/g, "testImport('$1')");
    await vm.runInContext(startup, ctx);
    expect(calls).toEqual(['s6', 'navigation', 'sharing', 'route']);
    expect(main.innerHTML).toBe('');
    expect(ctx.D.matches).toHaveLength(data.matches.length);
    expect(ctx.Nameplates).toBe(nameplates);
    expect(ctx.Jackets).toBe(['module', 'both'].includes(failure) ? null : jackets);
    if (failure.startsWith('palette-') || failure === 'both') expect(jackets.paletteForTitle(ctx.JacketColors, 'Cosy Catastrophe')).toBeNull();
    else expect(ctx.JacketColors).toBe(palettes);
  });
});

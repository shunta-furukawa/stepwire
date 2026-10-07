import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { nameplateMarkup, nameplateParts } from '../public/bpl/nameplates.js';
import * as nameplates from '../public/bpl/nameplates.js';
import data from '../public/bpl/data.json';
import brand from '../public/bpl/brand.json';

// Independent expected lettering, including spelling, mixed case, all ZERO
// teams and the season-specific LEISURELAND / レジャーランド identities.
const expected = [
  ['APINA VRAMeS', 'split', 'APINA', 'VRAMeS'],
  ['GiGO', 'short', '', 'GiGO'],
  ['GAME PANIC', 'equal', 'GAME', 'PANIC'],
  ['SILK HAT', 'equal', 'SILK', 'HAT'],
  ['SUPERNOVA Tohoku', 'long-split', 'SUPERNOVA', 'Tohoku'],
  ['TAITO STATION Tradz', 'split', 'TAITO STATION', 'Tradz'],
  ['ROUND1', 'mid', '', 'ROUND1'],
  ['LEISURELAND', 'long', '', 'LEISURELAND'],
  ['レジャーランド', 'jp', '', 'レジャーランド'],
  ['Team BLUE', 'split', 'Team', 'BLUE'],
  ['Team WHITE', 'split', 'Team', 'WHITE'],
  ['Team RED', 'split', 'Team', 'RED'],
] as const;
const script = readFileSync('public/bpl/app.js', 'utf8');

function logoHarness() {
  const ctx = vm.createContext({
    document: { querySelector: () => ({}) },
    inputData: structuredClone(data), inputBrand: structuredClone(brand), inputNameplates: nameplates,
  });
  // Execute the shipped logo/teamName/teamVars functions, not a duplicate test
  // renderer. Later page handlers and network bootstrap are unnecessary here.
  vm.runInContext(script.slice(0, script.indexOf('function portrait(')), ctx);
  vm.runInContext('D=inputData;B=inputBrand;Nameplates=inputNameplates;for(const [id,t] of Object.entries(B.teams))Object.assign(D.teams[id],t)', ctx);
  return (id: string, season: number | string, cls = '') => vm.runInContext(`logo(${JSON.stringify(id)},${JSON.stringify(season)},${JSON.stringify(cls)})`, ctx) as string;
}

describe('BPL original team nameplates', () => {
  it.each(expected)('preserves the approved %s lettering', (name, kind, top, main) => {
    expect(nameplateParts(name)).toEqual({ kind, top, main });
    const html = nameplateMarkup(name);
    expect(html).toContain(`class="team-nameplate np-${kind}"`);
    expect(html).toContain(`role="img" aria-label="${name}"`);
    expect(html).toContain('<span class="nameplate-copy" aria-hidden="true">');
    expect(html).toContain(`<span class="nameplate-main">${main}</span>`);
    if (top) expect(html).toContain(`<span class="nameplate-top">${top}</span>`);
    else expect(html).not.toContain('nameplate-top');
    expect(html).not.toMatch(/<img|<svg|<canvas|https?:|data:|url\(|team-logo|team-text/i);
  });

  it('covers every archive identity and the S6 alias without changing the data', () => {
    const names = new Set<string>(Object.values(data.teams).map(team => team.name));
    for (const team of Object.values(brand.teams)) if ('currentName' in team) names.add(team.currentName);
    expect([...names].sort()).toEqual(expected.map(([name]) => name).sort());
    for (const name of names) expect(nameplateParts(name).kind, name).not.toBe('fallback');
    expect(data.teams.leisure_land.name).toBe('レジャーランド');
    expect(brand.teams.leisure_land.currentName).toBe('LEISURELAND');
  });

  it('returns independent parts so callers cannot mutate shared lettering', () => {
    const changed = nameplateParts('APINA VRAMeS');
    changed.main = 'Changed';
    changed.top = 'Changed';
    changed.kind = 'fallback';
    expect(nameplateParts('APINA VRAMeS')).toEqual({ kind: 'split', top: 'APINA', main: 'VRAMeS' });
  });

  it.each(['Future Team', '__proto__', 'constructor', 'toString', 'hasOwnProperty'])('keeps unknown identity %s as readable fallback text', name => {
    expect(nameplateParts(name)).toEqual({ kind: 'fallback', top: '', main: name });
    expect(nameplateMarkup(name)).toContain(`class="nameplate-main">${name}</span>`);
    expect(nameplateMarkup(name)).toContain(`aria-label="${name}"`);
  });

  it('escapes names, classes and style attributes without adding executable markup', () => {
    const value = '" onmouseover="alert(1) & <img src=x> \'end\'';
    const escaped = '&quot; onmouseover=&quot;alert(1) &amp; &lt;img src=x&gt; &#39;end&#39;';
    const html = nameplateMarkup(value, value, value);
    expect(html).toContain(`aria-label="${escaped}"`);
    expect(html).toContain(`style="${escaped}"`);
    expect(html).toContain(`np-fallback ${escaped}"`);
    expect(html).toContain(`class="nameplate-main">${escaped}</span>`);
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/" onmouseover="/);
  });

  it('uses the same complete identity at every placement, including compact sizes', () => {
    for (const [name, kind, top, main] of expected) {
      for (const cls of ['', 'match-logo', 'detail-logo', 'team-card-logo', 'team-hero-logo']) {
        const style = '--team:#f00;--team-text:#ff7070;--team-rgb:255,0,0;--team-art:none';
        const html = nameplateMarkup(name, cls, style);
        expect(html).toContain(`class="team-nameplate np-${kind}${cls ? ' ' + cls : ''}"`);
        expect(html).toContain(`style="${style}"`);
        expect(html).toContain(`aria-label="${name}"`);
        expect(html).toContain(`class="nameplate-main">${main}</span>`);
        if (top) expect(html).toContain(`class="nameplate-top">${top}</span>`);
      }
    }
  });

  it('routes shipped team rendering through season-aware names and existing team colors', () => {
    const logo = logoHarness();
    for (const [id, team] of Object.entries(data.teams)) {
      const color = brand.teams[id as keyof typeof brand.teams];
      const vars = `--team:${color.color};--team-text:${color.textColor};--team-rgb:${color.rgb};--team-art:none`;
      for (const season of [0, 2, 4, 5, 6, '6']) {
        const currentName = 'currentName' in color ? color.currentName : team.name;
        const name = Number(season) === 6 ? currentName : team.name;
        expect(logo(id, season, 'match-logo'), `${id} S${season}`).toBe(nameplateMarkup(name, 'match-logo', vars));
      }
    }
    expect(logo('leisure_land', 5)).toContain('aria-label="レジャーランド"');
    expect(logo('leisure_land', 6)).toContain('aria-label="LEISURELAND"');
    expect(logo('supernova_tohoku', 2)).toContain('aria-label="SUPERNOVA Tohoku"');
    expect(logo('WHITE', 0)).toContain('aria-label="Team WHITE"');
  });

  it('loads the same text renderer before the initial route', () => {
    const bootstrap = script.slice(script.indexOf('Promise.all([...['), script.indexOf('// Share URLs carry'));
    expect(bootstrap).toContain("import('/bpl/nameplates.js')");
    expect(bootstrap).toMatch(/Nameplates=nameplates[^]*route\(\)/);
  });
});

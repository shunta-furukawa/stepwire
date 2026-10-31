import { describe, expect, it } from 'vitest';
import { applyFilter, matchesFilter } from '../lib/news/filter';
import { loadSources } from '../lib/news/sources';
import type { RawItem } from '../lib/news/types';

const item = (title: string, summary?: string): RawItem => ({
  url: 'https://example.com/news', title, summary,
});

// Feed title/summary preserved from the collector payloads in issues #97/#99.
const nomadDrive = item(
  'ボロボロのRV車を修理しながら終末世界を冒険。最大4人協力型サバイバルドライブゲーム「Nomad Drive」，配信開始',
  'IndieDevilは本日（2026年10月29日），新作タイトル「NomadDrive」をリリースした。本作は，ランダム生成されたポストアポカリプスの世界を，ボロボロのRV車を修理しながら探索する最大4人協力型のサバイバルドライブゲームだ。',
);
const chartPack = item(
  '[DDR GRAND PRIX] Chart Pack vol.8',
  'DDR GRAND PRIX chart pack vol.8 will be available for purchase as of October 29, 2026. Buying the pack will grant you access to CHALLENGE charts for: 「Bloody Tears(IIDX EDITION) / […]',
);

describe('DDR abbreviation boundaries', () => {
  it.each([
    'DDR', 'DDR WORLD', '[DDR GRAND PRIX] Chart Pack vol.8',
    'DDRの新曲', '新しいDDRが登場', '「DDR」', '#DDR', 'DDR/WORLD',
    'ddr world', 'DdRの新曲', '_DDR_',
  ])('keeps standalone DDR in %s in either field', (text) => {
    expect(matchesFilter(item(text), { include: ['DDR'] })).toBe(true);
    expect(matchesFilter(item('新着情報', text), { include: ['dDr'] })).toBe(true);
  });

  it.each(['NomadDrive', 'nomaddrive', 'XDDR', 'DDRX', '1DDR', 'DDR5', 'GDDR6'])(
    'rejects DDR embedded in ASCII letters or digits: %s', (text) => {
      expect(matchesFilter(item(text), { include: ['DDR'] })).toBe(false);
      expect(matchesFilter(item('新着情報', text), { include: ['ddr'] })).toBe(false);
    },
  );

  it('finds a standalone occurrence after an embedded occurrence', () => {
    expect(matchesFilter(item('NomadDriveとDDR WORLD'), { include: ['DDR'] })).toBe(true);
  });

  it('uses the same boundaries for exclude, which still takes precedence', () => {
    expect(matchesFilter(nomadDrive, { exclude: ['DDR'] })).toBe(true);
    expect(matchesFilter(chartPack, { include: ['Chart Pack'], exclude: ['ddr'] })).toBe(false);
  });
});

describe('existing filter semantics', () => {
  it.each([undefined, {}, { include: [] }])('keeps unfiltered items: %j', (filter) => {
    expect(matchesFilter(nomadDrive, filter)).toBe(true);
  });

  it.each(['DanceDanceRevolution', 'BEMANI', 'ダンスダンスレボリューション'])(
    'preserves case-insensitive substring matching for %s', (term) => {
      expect(matchesFilter(item(`prefix${term.toLowerCase()}suffix`), { include: [term] })).toBe(true);
      expect(matchesFilter(item('新着', `prefix${term.toLowerCase()}suffix`), { exclude: [term] })).toBe(false);
    },
  );

  it('treats terms literally rather than as regexes', () => {
    expect(matchesFilter(item('v1x2'), { include: ['v1.2'] })).toBe(false);
    expect(matchesFilter(item('v1.2'), { include: ['v1.2'] })).toBe(true);
  });

  it('ORs includes and lets an exclusion override a match', () => {
    const news = item('DanceDanceRevolution WORLD/MenuBar');
    expect(matchesFilter(news, { include: ['DDR', 'DanceDanceRevolution'] })).toBe(true);
    expect(matchesFilter(news, {
      include: ['DDR', 'DanceDanceRevolution'], exclude: ['MenuBar'],
    })).toBe(false);
    expect(matchesFilter(news, { include: [], exclude: ['MenuBar'] })).toBe(false);
  });

  it('preserves order and reports the number removed', () => {
    const world = item('DDR WORLD');
    expect(applyFilter([nomadDrive, chartPack, world], { include: ['DDR'] })).toEqual({
      kept: [chartPack, world], removed: 1,
    });
    expect(applyFilter([nomadDrive])).toEqual({ kept: [nomadDrive], removed: 0 });
  });
});

describe('current source registry regressions', () => {
  it('rejects issue #97 and keeps issue #99 under the real source filters', async () => {
    const sources = await loadSources();
    for (const id of ['4gamer', 'bemaniwiki']) {
      const source = sources.find((source) => source.id === id)!;
      expect(source.filter?.include).toContain('DDR');
      expect(matchesFilter(nomadDrive, source.filter)).toBe(false);
      expect(matchesFilter(chartPack, source.filter)).toBe(true);
    }
    const community = sources.find((source) => source.id === 'ddrcommunity')!;
    expect(community).toBeDefined();
    expect(matchesFilter(chartPack, community.filter)).toBe(true);
  });
});

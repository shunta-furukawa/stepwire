import { describe, expect, it } from 'vitest';
import { GET } from '../app/bpl/s/route';
import { shareQuery, summaryRevision } from '../lib/bpl/share';
import data from '../public/bpl/data.json';

const meta = (html: string, key: string) => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1]?.replaceAll('&amp;', '&');
const canonical = (html: string) => html.match(/<link rel="canonical" href="([^"]*)"/)?.[1]?.replaceAll('&amp;', '&');
const trimPlaintextPunctuation = (value: string) => value.replace(/[.,!?;:)\]}"'。、！？）］｝」』】]+$/u, '');

describe('crawler-readable BPL metadata without JavaScript', () => {
  it.each([
    ['view=player&id=O4MA.', 'O4MA.', 'Single 10勝 0分 4敗'],
    ['view=team&id=apina_vrames&rosterSeason=4', 'APINA VRAMeS', '4勝 2分 9敗'],
    ['view=team&id=WHITE', 'Team WHITE', 'ZERO所属選手'],
    ['view=player&id=DIS', 'DIS', '0試合出場'],
  ])('serves the specific entity before any script runs: %s', async (query, title, description) => {
    const response = await GET(new Request(`https://example.com/bpl/s?${query}`, { headers: { 'user-agent': 'Twitterbot/1.0' } }));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(meta(html, 'og:title')).toBe(`${title} — STEPWIRE`);
    expect(meta(html, 'twitter:title')).toBe(meta(html, 'og:title'));
    expect(meta(html, 'og:description')).toContain(description);
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
    const image = new URL(meta(html, 'og:image')!);
    expect(image.pathname).toBe('/bpl/og');
    expect(image.searchParams.get('id')).toBe(new URLSearchParams(query).get('id'));
    expect(image.searchParams.get('v')).toBe(summaryRevision);
    expect(meta(html, 'og:image:width')).toBe('1200');
    expect(meta(html, 'og:image:height')).toBe('630');
    expect(meta(html, 'og:image:type')).toBe('image/png');
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(meta(html, 'og:url')).not.toContain('#');
  });

  it('keeps legacy match and head-to-head cards available', async () => {
    for (const query of ['view=match&id=s5-final-1', 'view=matrix&previewA=round1&previewB=gigo']) {
      const response = await GET(new Request(`https://example.com/bpl/s?${query}`));
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(meta(html, 'og:image')).toContain(new URLSearchParams(query).get('view'));
    }
  });

  it.each(['O4MA.', 'ZERO.', 'A.N.C.B.', 'MOO-G.56', '$RYO$', 'UN-RE'])('keeps crawler metadata and the summary image tied to the exact punctuation ID: %s', async id => {
    const shared = 'https://example.com/bpl/s?' + shareQuery(new URLSearchParams({view:'player', id}));
    for (const input of [shared, trimPlaintextPunctuation(shared + '.)'), 'https://example.com/bpl/s?view=player&id=' + id]) {
      const response = await GET(new Request(input, {headers:{'user-agent':'Twitterbot/1.0'}}));
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(meta(html, 'og:title')).toBe(`${id} — STEPWIRE`);
      expect(meta(html, 'twitter:title')).toBe(`${id} — STEPWIRE`);
      expect(html).toContain(`<title>${id} — STEPWIRE</title>`);
      expect(meta(html, 'og:description')).toContain(`${id}。通算個人成績`);
      expect(canonical(html)).toBe(meta(html, 'og:url'));
      expect(meta(html, 'twitter:image')).toBe(meta(html, 'og:image'));
      for (const target of [canonical(html), meta(html, 'og:url'), meta(html, 'og:image'), meta(html, 'twitter:image')]) {
        expect(target).toBeDefined();
        expect(target).toMatch(/&linkVersion=1$/);
        expect(trimPlaintextPunctuation(target! + '.')).toBe(target);
        if (id.includes('.')) expect(target).toContain('%2E');
        const parsed = new URL(target!);
        expect(parsed.searchParams.get('view')).toBe('player');
        expect(parsed.searchParams.get('id')).toBe(id);
        expect(parsed.searchParams.get('summaryVersion')).toBe('1');
      }
      const image = new URL(meta(html, 'og:image')!);
      expect(image.pathname).toBe('/bpl/og');
      expect(image.searchParams.get('v')).toBe(summaryRevision);
    }
  });

  it('serves a distinct canonical and summary image for every registered player', async () => {
    const canonicals = new Set<string>(), images = new Set<string>();
    for (const {id, name} of data.players) {
      const query = shareQuery(new URLSearchParams({view:'player', id}));
      const response = await GET(new Request('https://example.com/bpl/s?' + query));
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(meta(html, 'og:title')).toBe(`${name} — STEPWIRE`);
      expect(new URL(canonical(html)!).searchParams.get('id')).toBe(id);
      expect(new URL(meta(html, 'og:image')!).searchParams.get('id')).toBe(id);
      canonicals.add(canonical(html)!);
      images.add(meta(html, 'og:image')!);
    }
    expect(canonicals.size).toBe(data.players.length);
    expect(images.size).toBe(data.players.length);
  });

  it('does not serve a generic success card for an unknown entity', async () => {
    const response = await GET(new Request('https://example.com/bpl/s?view=player&id=missing'));
    expect(response.status).toBe(404);
  });
});

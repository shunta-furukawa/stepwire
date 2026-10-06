import { describe, expect, it } from 'vitest';
import { GET } from '../app/bpl/s/route';
import { summaryRevision } from '../lib/bpl/share';

const meta = (html: string, key: string) => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1]?.replaceAll('&amp;', '&');

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

  it('does not serve a generic success card for an unknown entity', async () => {
    const response = await GET(new Request('https://example.com/bpl/s?view=player&id=missing'));
    expect(response.status).toBe(404);
  });
});

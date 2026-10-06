import { describe, expect, it } from 'vitest';
import { shareQuery } from '../public/bpl/urls.js';
import data from '../public/bpl/data.json';

const trimPlaintextPunctuation = (value: string) => value.replace(/[.,!?;:)\]}"'。、！？）］｝」』】]+$/u, '');

describe('BPL shared URL serialization', () => {
  it('encodes periods without changing IDs or mutating the supplied parameters', () => {
    const params = new URLSearchParams({view:'player', id:'O4MA.', query:'A.N.C.B. / $RYO$ & UN-RE', v:'revision.1'});
    const original = params.toString();
    const query = shareQuery(params);
    expect(params.toString()).toBe(original);
    expect(query).not.toContain('.');
    expect(query).toContain('id=O4MA%2E');
    expect(query).toContain('v=revision%2E1');
    const restored = new URLSearchParams(query);
    for (const [key, value] of params) expect(restored.get(key)).toBe(value);
    expect(query).toMatch(/&linkVersion=1$/);
  });

  it('normalizes existing version markers and always moves the marker to the end', () => {
    const params = new URLSearchParams('linkVersion=old&view=player&linkVersion=2&id=O4MA.');
    const original = params.toString();
    const query = shareQuery(params);
    expect(query).toBe('view=player&id=O4MA%2E&linkVersion=1');
    expect(new URLSearchParams(query).getAll('linkVersion')).toEqual(['1']);
    expect(shareQuery(new URLSearchParams(query))).toBe(query);
    expect(params.toString()).toBe(original);
  });

  it('preserves every player as a unique URL when a plaintext autolinker strips trailing punctuation', () => {
    const links = data.players.map(({id}) => {
      const link = 'https://stepwire.test/bpl/s?' + shareQuery(new URLSearchParams({view:'player', id}));
      if (id.includes('.')) expect(link).toContain('%2E');
      expect(link).toMatch(/&linkVersion=1$/);
      for (const suffix of ['', '.', ',', '.)', '。', '」']) {
        const autolink = trimPlaintextPunctuation(link + suffix);
        expect(autolink).toBe(link);
        expect(new URL(autolink).searchParams.get('id')).toBe(id);
      }
      return link;
    });
    expect(new Set(links).size).toBe(data.players.length);
  });
});

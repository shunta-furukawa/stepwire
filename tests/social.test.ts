import { describe, expect, it } from 'vitest';
import { articleSocialImage } from '../lib/content/social';
import { absoluteUrl } from '../lib/site';

describe('article sharing image', () => {
  it('resolves a local poster to the canonical origin with dimensions and alt text', () => {
    const image = articleSocialImage({
      contentHash: 'abcd1234',
      thumbnail: { src: 'images/poster.jpg', alt: 'The article poster', width: 1280, height: 720 },
    });
    expect(image).toEqual({
      url: absoluteUrl('/images/poster.jpg?v=abcd1234'),
      alt: 'The article poster', width: 1280, height: 720,
    });
  });

  it('leaves the generated card in control when no poster is chosen', () => {
    expect(articleSocialImage({ contentHash: 'a' })).toBeUndefined();
  });

  it('changes the image URL on article edits without changing the asset path', () => {
    const thumbnail = { src: '/images/poster.jpg', alt: 'Poster' };
    const before = articleSocialImage({ thumbnail, contentHash: 'before' });
    const after = articleSocialImage({ thumbnail, contentHash: 'after' });
    expect(before?.url).not.toBe(after?.url);
    expect(new URL(after!.url).pathname).toBe('/images/poster.jpg');
  });
});

import { describe, expect, it } from 'vitest';
import { collectCitations, parseMarkdown, toPlainText } from '../lib/content/markdown';
import { STEP_ANALYZER_ORIGIN, stepAnalyzerEmbedUrl, stepAnalyzerUrlSchema } from '../lib/content/step-analyzer';

describe('Step Analyzer article embeds', () => {
  it('keeps chart, footwork and timing parameters while projecting no video prose', () => {
    const query = 'd=SAMPLE_base64-url&f=48L-96RR&b=130,64:650&s=64:0.5&tr=mirror&hs=2&sp=0.5&hl=48&hc=48:hello&df=317&t=Practice';
    const url = `${STEP_ANALYZER_ORIGIN}/?${query}`;
    const blocks = parseMarkdown(`Before.[^1]\n@[step-analyzer](${url} "踏み順の例")\nAfter.`);
    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'step-analyzer', 'paragraph']);
    expect(toPlainText(blocks)).toBe('Before.\n\nAfter.');
    expect(collectCitations(blocks)).toEqual([1]);
    const embed = new URL(stepAnalyzerEmbedUrl(url));
    expect(embed.pathname).toBe('/embed');
    expect([...embed.searchParams]).toEqual([...new URL(url).searchParams]);
  });

  it('accepts raw charts and normalizes an embed link back to a standalone link', () => {
    const url = `${STEP_ANALYZER_ORIGIN}/embed?n=10000100&embed=1#unused`;
    expect(stepAnalyzerUrlSchema.parse(url)).toBe(`${STEP_ANALYZER_ORIGIN}/?n=10000100`);
  });

  it.each([
    'javascript:alert(1)',
    'https://example.com/?n=1000',
    `${STEP_ANALYZER_ORIGIN}.evil.example/?n=1000`,
    'https://user:password@step-analyzer-beta.vercel.app/?n=1000',
    'http://step-analyzer-beta.vercel.app/?n=1000',
    `${STEP_ANALYZER_ORIGIN}/api/media?n=1000`,
    `${STEP_ANALYZER_ORIGIN}/`,
    `${STEP_ANALYZER_ORIGIN}/?n=&d=`,
  ])('rejects unsafe or chartless frame URLs: %s', (url) => {
    expect(() => parseMarkdown(`@[step-analyzer](${url} "譜面")`)).toThrow();
  });

  it.each(['@[step-analyzer](broken)', `@[step-analyzer](${STEP_ANALYZER_ORIGIN}/?n=1000 " ")`])(
    'fails content validation instead of silently displaying a broken directive', (input) => {
      expect(() => parseMarkdown(input)).toThrow();
    },
  );
});

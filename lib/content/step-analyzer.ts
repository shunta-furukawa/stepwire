import { z } from 'zod';

// The player is a separate application; never turn arbitrary article URLs into frames.
export const STEP_ANALYZER_ORIGIN = 'https://step-analyzer-beta.vercel.app';

export const stepAnalyzerUrlSchema = z.string().max(100_000).transform((input, ctx) => {
  try {
    const url = new URL(input);
    if (url.origin !== STEP_ANALYZER_ORIGIN || url.username || url.password ||
        !['/', '/embed', '/embed/'].includes(url.pathname) ||
        !(url.searchParams.get('n') || url.searchParams.get('d'))) {
      throw new Error('invalid player URL');
    }
    url.pathname = '/';
    url.hash = '';
    url.searchParams.delete('embed');
    return url.toString();
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Step Analyzerの譜面共有URL（nまたはd付き）を指定してください' });
    return z.NEVER;
  }
});

export function stepAnalyzerEmbedUrl(input: string): string {
  const url = new URL(stepAnalyzerUrlSchema.parse(input));
  url.pathname = '/embed';
  return url.toString();
}

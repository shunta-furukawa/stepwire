import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

// Inventory evidence, never infer a reuse permission from a credit or filename.
const assets = new Map();
for (const file of readdirSync('content/articles').filter(f => f.endsWith('.mdx')).sort()) {
  const raw = readFileSync(join('content/articles', file), 'utf8');
  const fm = parse(raw.split(/^---\s*$/m)[1]);
  for (const [usage, entries] of [['hero', [fm.heroImage]], ['thumbnail', [fm.thumbnail]], ['media', fm.media ?? []]]) {
    for (const entry of entries.filter(Boolean)) {
      const path = entry.src.replace(/^\//, '');
      if (!assets.has(path)) assets.set(path, { path: `public/${path}`, review: 'pending', uses: [] });
      assets.get(path).uses.push({ article: file, status: fm.status, usage, credit: entry.credit ?? '', kind: entry.kind ?? null, sources: (fm.sources ?? []).map(s => s.url) });
    }
  }
}
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(png|jpe?g|webp|svg|gif)$/i.test(path)) {
      const key = path.replace(/^public\//, '');
      if (!assets.has(key)) assets.set(key, { path, review: 'pending', uses: [] });
    }
  }
}
walk('public/images/articles');
const result = { note: 'Inventory only. Credits and article source URLs are evidence, not permission. Draft assets under public/ are still directly accessible. Sources may describe the article rather than the precise image origin. Website, social thumbnails and video reuse need separate review.', assets: [...assets.values()].sort((a,b) => a.path.localeCompare(b.path, 'en')) };
if (process.argv.includes('--write')) writeFileSync('docs/article-assets-review.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ assets: result.assets.length, usedByPublishedArticles: result.assets.filter(a => a.uses.some(u => u.status === 'published')).length, pending: result.assets.length }, null, 2));

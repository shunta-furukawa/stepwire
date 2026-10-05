import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// This is a regression check for the current artwork-free BPL policy,
// not a copyright or permission classifier.
export function checkBplAssets(root, approvedIcons) {
  const issues = [];
  const allowedFields = {
    teams: new Set(['source', 'season', 'color', 'textColor', 'rgb', 'currentName', 'social']),
    players: new Set(['source', 'season', 'reading', 'social']),
    seasons: new Set(['source']),
    music: new Set(),
  };
  const brand = JSON.parse(readFileSync(join(root, 'public/bpl/brand.json'), 'utf8'));
  for (const [group, fields] of Object.entries(allowedFields)) {
    for (const [id, record] of Object.entries(brand[group] ?? {})) {
      if (group === 'music') issues.push(`brand.music.${id}: artwork metadata requires review`);
      for (const key of Object.keys(record)) {
        if (!fields.has(key)) issues.push(`brand.${group}.${id}.${key}: unreviewed metadata field`);
      }
    }
  }
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const name = relative(root, path).replaceAll('\\', '/');
      if (entry.isSymbolicLink()) { issues.push(`${name}: symlink not allowed`); continue; }
      if (entry.isDirectory()) { walk(path); continue; }
      const bytes = readFileSync(path);
      if (/\.(?:html|css|js|json|webmanifest)$/.test(name)) {
        if (/eacache\.|\/bpl\/assets\//i.test(bytes.toString())) issues.push(`${name}: legacy artwork reference`);
      } else {
        const hash = createHash('sha256').update(bytes).digest('hex');
        if (approvedIcons[name] !== hash) issues.push(`${name}: unreviewed file (only original SW icons are approved)`);
      }
    }
  }
  walk(join(root, 'public/bpl'));
  const vendor = join(root, 'vendor');
  try {
    for (const file of readdirSync(vendor)) {
      if (file.startsWith('bpl-assets')) issues.push(`vendor/${file}: legacy artwork bundle`);
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return issues;
}

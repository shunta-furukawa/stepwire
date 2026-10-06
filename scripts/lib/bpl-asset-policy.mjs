import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// This is a regression check for the BPL asset inventory,
// not a copyright or permission classifier.
export function checkBplAssets(root, approvedIcons, generated = { portraits: {} }) {
  const issues = [];
  const generatedHashes = {};
  const referenceHashes = new Set(Object.values(generated.portraits ?? {}).map(record => record.referenceSha256));
  const allowedFields = {
    teams: new Set(['source', 'season', 'color', 'textColor', 'rgb', 'currentName', 'social']),
    players: new Set(['source', 'season', 'reading', 'social', 'illustration']),
    seasons: new Set(['source']),
    music: new Set(),
  };
  const brand = JSON.parse(readFileSync(join(root, 'public/bpl/brand.json'), 'utf8'));
  for (const [id, record] of Object.entries(generated.portraits ?? {})) {
    const label = `generated.portraits.${id}`;
    if (!/^\/bpl\/portraits\/[a-z0-9-]+\.webp$/.test(record.src ?? '')) {
      issues.push(`${label}: expected local generated portrait path`);
      continue;
    }
    if (!brand.players?.[id] || brand.players[id].illustration !== record.src) issues.push(`${label}: player mapping mismatch`);
    if (record.generationMethod !== 'OpenAI built-in imagegen' || !record.sourceUrl || !record.rightsStatus) issues.push(`${label}: missing generation provenance`);
    if (!/^[a-f0-9]{64}$/.test(record.sha256 ?? '') || !/^[a-f0-9]{64}$/.test(record.referenceSha256 ?? '')) issues.push(`${label}: invalid asset digest`);
    if (referenceHashes.has(record.sha256)) issues.push(`${label}: reference photograph cannot be served`);
    const path = `public${record.src}`;
    if (Object.hasOwn(generatedHashes, path)) issues.push(`${label}: portrait path reused by multiple players`);
    generatedHashes[path] = record.sha256;
    try {
      if (createHash('sha256').update(readFileSync(join(root, path))).digest('hex') !== record.sha256) issues.push(`${label}: generated portrait bytes changed`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      issues.push(`${label}: generated portrait missing`);
    }
  }
  for (const [group, fields] of Object.entries(allowedFields)) {
    for (const [id, record] of Object.entries(brand[group] ?? {})) {
      if (group === 'players' && record.illustration !== undefined && generated.portraits?.[id]?.src !== record.illustration) issues.push(`brand.players.${id}.illustration: missing generated provenance`);
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
        if (approvedIcons[name] !== hash && generatedHashes[name] !== hash) issues.push(`${name}: unreviewed file (only inventoried original artwork and generated portraits are allowed)`);
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

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Keep the official artwork as one versioned bundle; deploy ordinary static files.
const archive = Buffer.concat(['001', '002'].map((part) =>
  readFileSync(new URL(`../vendor/bpl-assets.tar.gz.${part}`, import.meta.url))
));
const destination = fileURLToPath(new URL('../public/bpl/', import.meta.url));
const entries = execFileSync('tar', ['-tzf', '-'], { input: archive, encoding: 'utf8' }).trim().split('\n');
if (entries.some((entry) => !entry.startsWith('assets/') || entry.split('/').includes('..'))) {
  throw new Error('BPL asset bundle contains an unexpected path');
}
mkdirSync(destination, { recursive: true });
execFileSync('tar', ['-xzf', '-', '-C', destination], { input: archive });

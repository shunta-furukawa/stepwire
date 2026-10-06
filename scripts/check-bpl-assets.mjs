import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkBplAssets } from './lib/bpl-asset-policy.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const icons = JSON.parse(readFileSync(new URL('../docs/bpl-original-icons.json', import.meta.url), 'utf8'));
const portraits = JSON.parse(readFileSync(new URL('../docs/bpl-generated-portraits.json', import.meta.url), 'utf8'));
const issues = checkBplAssets(root, icons, portraits);
if (issues.length) {
  console.error('BPL artwork policy check failed:\n' + issues.join('\n'));
  process.exitCode = 1;
} else console.log('BPL artwork policy: OK (original icons and inventoried generated portraits; not rights clearance).');

import { rmSync } from 'node:fs';
// Remove legacy copied artwork even in reused workspaces/build caches.
// BPL uses original text labels and generic symbols until permission is verified.
rmSync(new URL('../public/bpl/assets/', import.meta.url), { recursive: true, force: true });

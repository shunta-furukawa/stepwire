import { rmSync } from 'node:fs';
// Remove legacy copied artwork even in reused workspaces/build caches.
// BPL does not deploy official artwork binaries; stale extracted copies stay removed.
rmSync(new URL('../public/bpl/assets/', import.meta.url), { recursive: true, force: true });

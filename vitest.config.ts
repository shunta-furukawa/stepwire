import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node environment only: everything under test is pure logic — schema
    // validation, URL normalisation, deduplication, markdown parsing and scene
    // derivation. Nothing here needs a DOM, and nothing here renders a video.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
  },
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // three.js alone is ~550 kB minified; split with dynamic import() once the game grows.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

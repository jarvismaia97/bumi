import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json so tested modules can use it.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

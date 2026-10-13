import { defineConfig } from 'vitest/config';

// Unit tests for the page's own scripts. The Worker has its own suite in worker/.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

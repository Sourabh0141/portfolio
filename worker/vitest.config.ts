import { defineConfig } from 'vitest/config';

// The Worker uses only standard Web APIs (fetch, Request, streams, Web Crypto), so these tests
// run in Node with every upstream call stubbed. Nothing here reaches the network.
// `npm run test:runtime` covers what Node cannot: the real Workers runtime and its bindings.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});

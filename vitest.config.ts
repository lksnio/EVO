import { defineConfig } from 'vitest/config';

// Tests für die reine Spiellogik (ohne Browser): Weltgenerator, Lebenszyklus, Vererbung, Server-Räume.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
  },
});

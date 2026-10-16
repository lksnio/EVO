import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 8080 },
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
});

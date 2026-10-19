import { defineConfig } from 'vite';
import { colyseus } from 'colyseus/vite';

// Ein Vite für beides: das Spiel (Client) und den Spielserver (Colyseus).
//   npm run dev   → Spiel und Server zusammen auf http://localhost:8080 (auch im lokalen Netz und über Tailscale)
//   npm run build → dist/client (das Spiel, auch für GitHub Pages) und dist/server/server.mjs (der Server)
//   npm start     → der gebaute Server auf Port 2567, der auch das Spiel ausliefert
export default defineConfig({
  base: './',
  server: {
    port: 8080,
    // auf allen Netzwerkschnittstellen erreichbar (nicht nur localhost) – so kommen Freunde über Tailscale herein
    host: true,
    // Tailscale-Namen (MagicDNS, z. B. mein-pc.tail1234.ts.net) zulassen
    allowedHosts: ['.ts.net'],
  },
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  plugins: [colyseus({ serverEntry: '/src/server/index.ts', serveClient: true, port: 2567 })],
});

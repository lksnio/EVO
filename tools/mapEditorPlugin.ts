import type { Plugin } from 'vite';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mapKey, parseWorldMap } from '../src/editor/document';

/** Development-only project save. No filesystem path comes from the request; static production builds expose no write route. */
export function mapEditorPlugin(): Plugin {
  let queue = Promise.resolve();
  return { name: 'evo-world-editor', configureServer(server) {
    server.middlewares.use('/__evo/maps', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      const fail = (status: number, error: string) => { res.statusCode = status; res.end(JSON.stringify({ error })); };
      if (req.method !== 'POST') { fail(405, 'Please save the map from the editor.'); return; }
      if (!req.headers['content-type']?.startsWith('application/json') || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) {
        fail(403, 'Save requests must come from this page\'s map editor.'); return;
      }
      let body = '', bytes = 0, oversized = false;
      req.on('data', chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) oversized = true; else body += chunk.toString(); });
      req.on('end', () => {
        if (oversized) { fail(413, 'The map file is too large (maximum 4 MB).'); return; }
        queue = queue.catch(() => {}).then(async () => {
          try {
            const map = parseWorldMap(JSON.parse(body));
            const file = resolve(server.config.root, 'src/data/maps/worlds.json');
            const all = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
            all[mapKey(map.epoch, map.place)] = map;
            await writeFile(file + '.tmp', JSON.stringify(all, null, 2) + '\n');
            await rename(file + '.tmp', file);
            res.end(JSON.stringify({ saved: true, key: mapKey(map.epoch, map.place) }));
          } catch (e) { fail(400, e instanceof Error ? e.message : 'Could not save the map.'); }
        });
      });
    });
  } };
}

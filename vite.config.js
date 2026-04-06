import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function generateSongsIndex() {
  const dir = path.resolve(__dirname, 'strudels');
  const results = [];

  function scan(folder, prefix) {
    const entries = fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.isDirectory()) {
        scan(path.join(folder, e.name), prefix ? prefix + '/' + e.name : e.name);
      } else if (e.name.endsWith('.js') && e.name !== 'index.js') {
        const rel = prefix ? `./${prefix}/${e.name}` : `./${e.name}`;
        results.push(rel);
      }
    }
  }
  scan(dir, '');

  const entries = results.map(f => `  { path: "${f}" },`).join('\n');
  const content = `export const songs = [\n${entries}\n];\n`;
  const indexPath = path.join(dir, 'index.js');
  const existing = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : '';
  if (content !== existing) {
    fs.writeFileSync(indexPath, content);
    console.log(`[songs] regenerated index.js (${results.length} songs)`);
  }
}

function songsPlugin() {
  return {
    name: 'watch-strudels',
    buildStart() {
      generateSongsIndex();
    },
    configureServer(server) {
      const dir = path.resolve(__dirname, 'strudels');
      server.watcher.add(dir);
      server.watcher.on('add', (f) => {
        if (f.startsWith(dir) && f.endsWith('.js') && !f.endsWith('index.js')) {
          generateSongsIndex();
        }
      });
      server.watcher.on('unlink', (f) => {
        if (f.startsWith(dir) && f.endsWith('.js') && !f.endsWith('index.js')) {
          generateSongsIndex();
        }
      });
    },
  };
}

export default defineConfig({
  server: {
    open: true,
  },
  plugins: [songsPlugin()],
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import { fileURLToPath } from 'url';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** Neueste Revision (z. B. „1.191“) aus dem Revisionsmenü: die gleiche Nummer zeigen Menü, Update-Knopf und FunFacts */
function latestRevision(): string {
  try {
    const txt = fs.readFileSync(new URL('./src/data/defaultSpools.ts', import.meta.url), 'utf8');
    const ids = [...txt.matchAll(/id: 'v(1\.\d+)'/g)].map(m => m[1]);
    return ids[ids.length - 1] || '';
  } catch {
    return '';
  }
}

// Echte Codezeilen für die Fun Facts, beim Bauen gezählt (TypeScript/React, Server, Android-Plugins)
function countCodeLines(): number {
  // fileURLToPath statt URL.pathname: unter Windows (Desktop-Build) ergab pathname einen kaputten Pfad („/D:/…“) und damit 0 Zeilen
  let root = process.cwd();
  try {
    root = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    /* cwd bleibt */
  }
  let total = 0;
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|java)$/.test(e.name) && !e.name.endsWith('.d.ts')) total += fs.readFileSync(p, 'utf8').split('\n').length;
    }
  };
  ['src', 'server', 'android-native'].forEach(d => walk(path.join(root, d)));
  if (fs.existsSync(path.join(root, 'server.ts'))) total += fs.readFileSync(path.join(root, 'server.ts'), 'utf8').split('\n').length;
  if (total === 0 && root !== process.cwd()) {
    // Zweiter Versuch vom Arbeitsordner aus
    const cwd = process.cwd();
    ['src', 'server', 'android-native'].forEach(d => walk(path.join(cwd, d)));
  }
  return total;
}

export default defineConfig(() => {
  return {
    // Für GitHub Pages wird per VITE_BASE ein Unterpfad gesetzt (z. B. /filament-website-google-ai/).
    base: process.env.VITE_BASE || '/',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_REVISION__: JSON.stringify(latestRevision()),
      __CODE_LINES__: JSON.stringify(countCodeLines())
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: false, // Verwende public/manifest.json
        devOptions: {
          enabled: false,
          type: 'module'
        },
        workbox: {
          importScripts: ['notify-click.js'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // React und weitere Bibliotheken in eigene Dateien: bleiben bei App-Updates im Cache, die App lädt schneller
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
              { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 15 },
              { name: 'vendor', test: /node_modules[\\/]/, priority: 10 }
            ]
          }
        }
      }
    }
  };
});

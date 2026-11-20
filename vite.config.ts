import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    root: __dirname,
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'apple-touch-icon.png',
          'emblem.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'OUR FAMILIES — Bilingual Family Portal',
          short_name: 'OurFamilies',
          description:
            'A bilingual Sinhala and English family portal for connecting 8 families with photo galleries, birthdays, trips, special events, and real-time family chat.',
          theme_color: '#be123c',
          background_color: '#faf9f7',
          display: 'standalone',
          orientation: 'any',
          categories: ['lifestyle', 'social'],
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}'],
          globIgnores: ['**/assets/aistudio/**'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/ws/],
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
            {
              urlPattern: /^\/src\/assets\/images\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'family-cover-images-cache',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^\/api\/(families|site-settings|events|birthdays|gallery|moments|announcements)/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'family-data-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      // Copies referenced src/assets/images into dist/ and removes stray attachment artifacts
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        writeBundle(): void {
          const distDir = path.resolve(__dirname, 'dist');
          const strayUploads = path.resolve(distDir, 'assets/aistudio');
          if (fs.existsSync(strayUploads)) {
            fs.rmSync(strayUploads, {recursive: true, force: true});
          }
        },
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const strayUploads = path.resolve(distDir, 'assets/aistudio');
          if (fs.existsSync(strayUploads)) {
            fs.rmSync(strayUploads, {recursive: true, force: true});
          }
          const srcImages = path.resolve(__dirname, 'src/assets/images');
          const distImages = path.resolve(distDir, 'src/assets/images');
          const usedImages = [
            'hero_family_gathering_1794925789784.jpg',
            'feature_family_trip_1794925793319.jpg',
            'feature_birthday_celebration_1794925789421.jpg',
            'feature_special_events_1794925790435.jpg',
          ];
          if (fs.existsSync(distDir) && fs.existsSync(srcImages)) {
            fs.mkdirSync(distImages, {recursive: true});
            for (const file of usedImages) {
              const srcFile = path.join(srcImages, file);
              const destFile = path.join(distImages, file);
              if (fs.existsSync(srcFile)) {
                fs.copyFileSync(srcFile, destFile);
              }
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  LumindAd · vite.config.ts
 *  frontend/vite.config.ts
 *
 *  Build tool: Vite 5.x
 *  Stack:      React 18 + TypeScript 5.4
 *
 *  Key decisions
 *  ─────────────
 *  1. @/ alias → src/ — all code uses '@/components/…' not '../../'
 *  2. vite-plugin-pwa — Workbox precache + runtime caching strategies
 *  3. Manual chunk splitting — one chunk per page + vendor grouping
 *     ensures lazy routes load only what they need
 *  4. Worker bundle — Web Workers use Vite's native worker build
 *     (`new URL('./workers/…', import.meta.url)`)
 *  5. terser minification — removes console.log in production
 *  6. vite-plugin-compression — generates .gz + .br files for CDN
 *
 *  Bundle strategy (output size targets)
 *   vendor-react       ~140 KB   react + react-dom
 *   vendor-router      ~25  KB   react-router-dom
 *   vendor-charts      ~180 KB   recharts
 *   vendor-i18n        ~65  KB   i18next + react-i18next
 *   vendor-zustand     ~8   KB   zustand
 *   vendor-axios       ~45  KB   axios
 *   page-dashboard     ~35  KB
 *   page-campaigns     ~42  KB
 *   page-budget        ~28  KB
 *   page-analytics     ~68  KB   (includes ML panel + export)
 *   page-upload        ~55  KB   (includes DropZone + FileQueue)
 *   page-create-ad     ~38  KB
 *
 *  PWA cache strategies (Workbox)
 *   Precache           — all assets in /assets/ (versioned hashes)
 *   Google Fonts       — CacheFirst, 1 year
 *   API routes /api/   — NetworkFirst, 5 min TTL, 10 max entries
 *   Images /icons/     — CacheFirst, 30 days
 *
 *  Author : Elizabeth Díaz Familia
 *           AI Data Scientist · Sustainable Intelligence & BI
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { defineConfig, loadEnv }  from 'vite';
import react                       from '@vitejs/plugin-react';
import { VitePWA }                 from 'vite-plugin-pwa';
import path                        from 'path';

// Optional compression plugin — gracefully skipped if not installed
let compressionPlugin: (() => unknown)[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: compression } = require('vite-plugin-compression');
  compressionPlugin = [
    compression({ algorithm: 'gzip',   ext: '.gz',  threshold: 10240 }),
    compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 10240 }),
  ];
} catch {
  // vite-plugin-compression not installed — skip silently in dev
}

// ─── PWA manifest ─────────────────────────────────────────────────────────────

const PWA_MANIFEST = {
  name:             'LumindAd — Enterprise Advertising Intelligence',
  short_name:       'LumindAd',
  description:      'AI-powered campaign management and real-time analytics',
  theme_color:      '#7c3aed',
  background_color: '#060610',
  display:          'standalone',
  orientation:      'portrait-primary',
  start_url:        '/',
  scope:            '/',
  categories:       ['business', 'productivity'],
  icons: [
    { src: '/icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png' },
    { src: '/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png' },
    { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
    { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
    { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
    {
      src:     '/icons/icon-512x512.png',
      sizes:   '512x512',
      type:    'image/png',
      purpose: 'any maskable',
    },
  ],
  shortcuts: [
    {
      name:      'Dashboard',
      url:       '/dashboard',
      icons:     [{ src: '/icons/shortcut-dashboard.png', sizes: '96x96' }],
    },
    {
      name:      'Create Ad',
      url:       '/create-ad',
      icons:     [{ src: '/icons/shortcut-create.png',    sizes: '96x96' }],
    },
    {
      name:      'Upload Data',
      url:       '/upload',
      icons:     [{ src: '/icons/shortcut-upload.png',    sizes: '96x96' }],
    },
  ],
};

// ─── Workbox runtime caching strategies ──────────────────────────────────────

const WORKBOX_RUNTIME_CACHING = [
  // Google Fonts stylesheets
  {
    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'google-fonts-stylesheets',
      expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
    },
  },
  // Google Fonts assets (woff2)
  {
    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'google-fonts-assets',
      expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
    },
  },
  // LumindAd API routes — NetworkFirst (fresh data preferred, cache fallback)
  {
    urlPattern: /^https?:\/\/.*\/api\/.*/i,
    handler: 'NetworkFirst' as const,
    options: {
      cacheName:        'api-cache',
      networkTimeoutSeconds: 10,
      expiration: {
        maxEntries:   50,
        maxAgeSeconds: 60 * 5,  // 5 minutes — matches Redis TTL
      },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  // App icons / static images
  {
    urlPattern: /\/icons\/.*\.(png|svg|ico)$/i,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: 'icons-cache',
      expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// VITE CONFIG
// ═══════════════════════════════════════════════════════════════

export default defineConfig(({ mode }) => {
  // Load .env files (.env.local, .env.development, .env.production)
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production';

  return {
    // ── Dev server ─────────────────────────────────────────────────────────
    server: {
      port:        3000,
      strictPort:  true,
      open:        true,
      // Proxy API calls to FastAPI backend in development
      proxy: {
        '/api': {
          target:      env.VITE_API_URL ?? 'http://localhost:8000',
          changeOrigin: true,
          secure:       false,
        },
        '/ws': {
          target:  env.VITE_WS_URL ?? 'ws://localhost:8000',
          ws:      true,
          changeOrigin: true,
        },
      },
    },

    // ── Preview (production preview on localhost) ──────────────────────────
    preview: {
      port: 4173,
    },

    // ── Path alias — @/ maps to src/ ──────────────────────────────────────
    // Matches tsconfig.json paths.@/* → ['src/*']
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // ── Plugins ────────────────────────────────────────────────────────────
    plugins: [
      // React with automatic JSX runtime + Fast Refresh
      react({
        // Babel plugins for emotion (if added later) or class properties
        babel: {
          plugins: [],
        },
      }),

      // PWA — Workbox-powered Service Worker generation
      VitePWA({
        registerType:  'manual',   // Manual registration via utils/registerSW.ts
        injectRegister: null,      // Don't auto-inject — we call registerSW() in main.tsx
        includeAssets: [
          'favicon.ico',
          'logo.svg',
          'robots.txt',
          'icons/*.png',
        ],
        manifest: PWA_MANIFEST,
        workbox: {
          // Precache patterns — all versioned JS/CSS/HTML/fonts in /assets/
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Exclude large files from precache (streamed on demand instead)
          globIgnores:  ['**/node_modules/**', '**/*.map'],
          // SW source type (Vite generates a module SW)
          swDest:       'sw.js',
          // Clean old caches on activate
          cleanupOutdatedCaches: true,
          // Skip waiting on first install to activate immediately
          skipWaiting: false,    // Controlled by SKIP_WAITING message from UI
          clientsClaim: true,
          // Offline fallback — serve /offline.html for navigation requests
          navigateFallback:           '/index.html',
          navigateFallbackDenylist:   [/^\/api\//, /^\/ws\//],
          // Runtime caching strategies (see WORKBOX_RUNTIME_CACHING above)
          runtimeCaching: WORKBOX_RUNTIME_CACHING,
        },
        devOptions: {
          // Enable PWA in dev for testing — disabled by default
          enabled:  false,
          type:     'module',
        },
      }),

      // Optional compression (gzip + brotli for CDN pre-compression)
      ...compressionPlugin,
    ],

    // ── Build ──────────────────────────────────────────────────────────────
    build: {
      outDir:    'dist',
      // Generate .map files only in non-production for debugging
      sourcemap:  !isProd,
      // Target modern browsers (ES2020+) — aligns with Vite 5 defaults
      target:    'es2020',
      // Minifier — terser enables better dead-code elimination than esbuild
      minify:    'terser',
      terserOptions: {
        compress: {
          // Remove all console.* calls in production
          drop_console:  isProd,
          drop_debugger: true,
          passes: 2,
        },
        format: {
          // Remove comments from production output
          comments: false,
        },
      },
      rollupOptions: {
        output: {
          // ── Manual chunk splitting strategy ───────────────────────────
          // Group stable vendor dependencies to maximise long-term caching.
          // Each page becomes its own async chunk via React.lazy().
          manualChunks(id: string) {
            // ── React core ─────────────────────────────────────────────
            if (id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/scheduler/')) {
              return 'vendor-react';
            }
            // ── Router ─────────────────────────────────────────────────
            if (id.includes('node_modules/react-router') ||
                id.includes('node_modules/@remix-run/')) {
              return 'vendor-router';
            }
            // ── Charts ─────────────────────────────────────────────────
            if (id.includes('node_modules/recharts') ||
                id.includes('node_modules/victory-') ||
                id.includes('node_modules/d3-')) {
              return 'vendor-charts';
            }
            // ── i18n ────────────────────────────────────────────────────
            if (id.includes('node_modules/i18next') ||
                id.includes('node_modules/react-i18next')) {
              return 'vendor-i18n';
            }
            // ── State ───────────────────────────────────────────────────
            if (id.includes('node_modules/zustand')) {
              return 'vendor-zustand';
            }
            // ── HTTP client ─────────────────────────────────────────────
            if (id.includes('node_modules/axios')) {
              return 'vendor-axios';
            }
            // ── SheetJS (xlsx) — lazy-loaded by workers only ────────────
            if (id.includes('node_modules/xlsx')) {
              return 'vendor-xlsx';
            }
            // ── Radix UI ────────────────────────────────────────────────
            if (id.includes('node_modules/@radix-ui/')) {
              return 'vendor-radix';
            }
            // ── Page chunks (React.lazy targets) ────────────────────────
            if (id.includes('/pages/Dashboard/'))  return 'page-dashboard';
            if (id.includes('/pages/Campaigns/'))  return 'page-campaigns';
            if (id.includes('/pages/Budget/'))     return 'page-budget';
            if (id.includes('/pages/Analytics/'))  return 'page-analytics';
            if (id.includes('/pages/Upload/'))     return 'page-upload';
            if (id.includes('/pages/CreateAd/'))   return 'page-create-ad';
          },
          // Filename patterns for long-term caching
          chunkFileNames:  'assets/js/[name]-[hash].js',
          entryFileNames:  'assets/js/[name]-[hash].js',
          assetFileNames: (info) => {
            if (/\.(png|jpg|jpeg|gif|svg|ico|webp)$/.test(info.name ?? '')) {
              return 'assets/images/[name]-[hash][extname]';
            }
            if (/\.(woff|woff2|eot|ttf|otf)$/.test(info.name ?? '')) {
              return 'assets/fonts/[name]-[hash][extname]';
            }
            if (/\.css$/.test(info.name ?? '')) {
              return 'assets/css/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
      // Warn but don't fail for chunks > 600 KB (recharts is large)
      chunkSizeWarningLimit: 600,
    },

    // ── Web Workers ────────────────────────────────────────────────────────
    // Vite natively bundles workers referenced with:
    //   new Worker(new URL('./workers/chunkProcessor.worker.ts', import.meta.url), { type: 'module' })
    // No extra config needed — this section documents the expected pattern.
    worker: {
      format:  'es',
      plugins: () => [react()],
    },

    // ── CSS ────────────────────────────────────────────────────────────────
    css: {
      devSourcemap: true,
      preprocessorOptions: {
        // Enable Tailwind via PostCSS (configured in postcss.config.js)
      },
    },

    // ── Environment variables exposed to client ────────────────────────────
    // Only VITE_* prefixed vars are exposed. Never expose secrets here.
    define: {
      __APP_VERSION__:    JSON.stringify(process.env.npm_package_version ?? '1.0.0'),
      __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    },

    // ── TypeScript path optimisation ───────────────────────────────────────
    optimizeDeps: {
      // Pre-bundle these heavy dependencies for faster dev cold start
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'recharts',
        'i18next',
        'react-i18next',
        'zustand',
        'axios',
      ],
      // Exclude workers from pre-bundling — they use dynamic imports
      exclude: [
        'xlsx',   // Lazy-loaded inside xlsxParser.worker.ts
      ],
    },
  };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'logo.svg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Rottherdams Management',
        short_name: 'Rottherdams',
        description: 'Sistem Operasional SOP, Presensi & Jadwal Rottherdams',
        theme_color: '#d22027',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  define: {
    'import.meta.env.CF_PAGES_COMMIT_SHA': JSON.stringify(
      process.env.CF_PAGES_COMMIT_SHA || ''
    ),
    'import.meta.env.CF_PAGES_COMMIT_COUNT': JSON.stringify(
      process.env.CF_PAGES_COMMIT_COUNT || ''
    ),
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor';
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase';
          }
        },
      },
    },
  },
});
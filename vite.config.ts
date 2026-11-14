import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

function getDeployCount(): string {
  try {
    // Tarik seluruh riwayat commit jika Cloudflare Pages melakukan shallow clone
    try {
      execSync('git fetch --unshallow', { stdio: 'ignore' });
    } catch {
      // Abaikan jika repo sudah full clone atau offline
    }

    const gitCommits = parseInt(
      execSync('git rev-list --count HEAD').toString().trim(),
      10
    );

    if (!isNaN(gitCommits) && gitCommits > 1) {
      // Kalibrasi agar sinkron dengan total 64 deploy di Cloudflare Pages
      // Jika gitCommits saat ini misalnya 58, offset +6 membuatnya menjadi 64 (v0.6)
      const BASELINE_GIT_COMMITS = 58;
      const BASELINE_CF_DEPLOYS = 64;
      const calibratedCount =
        gitCommits >= BASELINE_GIT_COMMITS
          ? BASELINE_CF_DEPLOYS + (gitCommits - BASELINE_GIT_COMMITS)
          : gitCommits;

      return String(calibratedCount);
    }
  } catch {
    // Fallback jika git tidak tersedia
  }
  return process.env.CF_PAGES_COMMIT_COUNT || '64';
}

function getGitCommitSha(): string {
  if (process.env.CF_PAGES_COMMIT_SHA) {
    return process.env.CF_PAGES_COMMIT_SHA;
  }
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return '';
  }
}

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
    'import.meta.env.CF_PAGES_COMMIT_SHA': JSON.stringify(getGitCommitSha()),
    'import.meta.env.CF_PAGES_COMMIT_COUNT': JSON.stringify(getDeployCount()),
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
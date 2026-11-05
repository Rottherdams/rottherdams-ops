import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <--- Memproses class Tailwind v4
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Rottherdams Management',
        short_name: 'Rottherdams',
        description: 'Sistem Operasional SOP, Presensi & Jadwal Rottherdams',
        theme_color: '#111111',
        background_color: '#ffffff',
        display: 'standalone',
      }
    })
  ]
});
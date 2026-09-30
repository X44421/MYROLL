import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './', // 设为相对路径，为后续转换 Android (Capacitor/Cordova) 做准备
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          app: path.resolve(__dirname, 'index.html'),
          grain: path.resolve(__dirname, 'grain-preview.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

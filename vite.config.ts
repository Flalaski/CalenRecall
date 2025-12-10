import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false, // Bundle all CSS into a single file to preserve order
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        preferences: path.resolve(__dirname, 'preferences.html'),
        about: path.resolve(__dirname, 'about.html'),
        'profile-selector': path.resolve(__dirname, 'profile-selector.html'),
        'import-progress': path.resolve(__dirname, 'import-progress.html'),
        'startup-loading': path.resolve(__dirname, 'startup-loading.html'),
        'archive-export': path.resolve(__dirname, 'archive-export.html'),
        'export-profile-selector': path.resolve(__dirname, 'export-profile-selector.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})


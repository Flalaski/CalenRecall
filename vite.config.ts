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
    minify: 'esbuild', // Faster than terser, good compression
    target: 'esnext', // Target modern browsers for better performance
    sourcemap: false, // Disable sourcemaps in production for smaller bundles
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
      output: {
        // Code splitting for better caching and loading performance
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'date-vendor': ['date-fns'],
        },
      },
    },
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'date-fns'],
  },
})


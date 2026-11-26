import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
    host: true,
    watch: {
      // Required on Windows/macOS Docker Desktop bind mounts so file changes propagate immediately
      usePolling: true,
      interval: 300,
    },
    hmr: {
      clientPort: 8080,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-map': ['leaflet'],
          'vendor-motion': ['framer-motion', 'canvas-confetti'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});

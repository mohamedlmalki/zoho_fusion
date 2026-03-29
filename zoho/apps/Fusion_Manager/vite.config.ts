import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5176, // Hardcoded port so the main dashboard knows exactly where to look
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Your backend PORT
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
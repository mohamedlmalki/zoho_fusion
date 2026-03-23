import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // or '@vitejs/plugin-react' depending on your install
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
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Make sure this matches your backend PORT
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
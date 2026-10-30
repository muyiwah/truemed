import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // Phone testing over an HTTPS tunnel (camera + mic need HTTPS).
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
    proxy: { '/api': { target: 'http://localhost:4080', changeOrigin: true } },
  },
});

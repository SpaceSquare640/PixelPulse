import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the built index.html works when loaded via
  // file:// from a packaged Electron app (not just from an http server).
  base: './',
  plugins: [react()],
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Project-page base path for GitHub Pages (https://<owner>.github.io/clinic-dashboards/).
  base: '/clinic-dashboards/',
})

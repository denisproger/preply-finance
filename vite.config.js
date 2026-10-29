import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes every asset URL relative, so the build works on
// https://<user>.github.io/<any-repo-name>/ without editing this file.
// Navigation uses hash routes (#/expenses), so GitHub Pages never has to
// resolve deep links on the server.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});

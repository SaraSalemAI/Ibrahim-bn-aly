// Single self-contained HTML build (no server needed): npm run build:single → release/SUMED-Audit-Platform.html
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'release-tmp', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 10_000 },
});

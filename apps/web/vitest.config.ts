import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@wf/billing': path.resolve(__dirname, '../../packages/billing/src'),
      '@wf/db': path.resolve(__dirname, '../../packages/db/src'),
      '@wf/auth': path.resolve(__dirname, '../../packages/auth/src'),
      '@wf/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});

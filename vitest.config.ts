import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/db': path.resolve(__dirname, './src/db'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/services': path.resolve(__dirname, './src/services'),
    },
  },
});

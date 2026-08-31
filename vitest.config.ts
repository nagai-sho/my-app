import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'lodash/isEqualWith': 'lodash/isEqualWith.js',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    server: {
      deps: {
        inline: ['@testing-library/jest-dom'],
      },
    },
    setupFiles: './src/test/setup.ts',
  },
});

import { defineConfig } from 'vite';

// base must match the GitHub Pages subpath (https://<user>.github.io/video/)
export default defineConfig({
  base: '/video/',
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    setupFiles: ['tests/unit/setup.js'],
  },
});

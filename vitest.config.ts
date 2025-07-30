import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    outputFile: {
      junit: './bin/test/junit.xml',
    },
    reporters: ['default', ...(process.env.CI === 'true' ? ['junit'] : [])],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/tests/**',
        '**/*.test.ts',
      ],
    },
  },
  plugins: [tsconfigPaths()],
});

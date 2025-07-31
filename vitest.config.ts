import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths'

const isE2E = process.env.E2E === 'true';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: isE2E ? ['src/e2e/**/*.test.ts'] : ['src/**/*.test.ts', '!src/e2e/**/*.test.ts'],
    exclude: [],
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

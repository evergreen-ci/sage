import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['dotenv-flow/config'],
    projects: [
       {
        extends: true,
        test: {
          include: ['src/e2e/**/*.test.ts'],
          name: { label: 'e2e', color: 'blue' },
        },
      },
      {
        extends: true,
        test: {
          name: { label: 'unit', color: 'green' },
          include: ['src/**/*.test.ts', '!src/e2e/**/*.test.ts'],
        },
      },
    ],
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

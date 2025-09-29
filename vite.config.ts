import { defineConfig, mergeConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig as defineTestConfig } from 'vitest/config';

const viteConfig = defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    ssr: true,
    outDir: 'dist',
    lib: {
      entry: 'src/main.ts',
      formats: ['es', 'cjs'],
      fileName: format => `index.${format === 'es' ? 'mjs' : 'js'}`,
    },
    sourcemap: true,
    rollupOptions: {
      external: [/node_modules/],
      output: {
        preserveModules: false,
      },
    },
  },
});

const vitestConfig = defineTestConfig({
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
          poolOptions: { forks: { singleFork: true } }, // Make tests run sequentially.
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
});

export default mergeConfig(viteConfig, vitestConfig);

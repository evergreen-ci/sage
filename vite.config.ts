import { execSync } from 'child_process';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig, mergeConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig as defineTestConfig } from 'vitest/config';

// Get version from environment or git, with proper fallback
const getVersion = () => {
  // First check if VERSION is already set (e.g., from Docker build)
  if (process.env.VERSION && process.env.VERSION !== 'unknown') {
    return process.env.VERSION;
  }

  // Try to get from git
  try {
    const gitSha = execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
    }).trim();
    return gitSha || 'unknown';
  } catch (error) {
    console.warn('Could not get git SHA, using "unknown" as version');
    return 'unknown';
  }
};

const version = getVersion();
console.log(`Building with VERSION: ${version}`);

const viteConfig = defineConfig({
  plugins: [
    tsconfigPaths(),
    sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'mongodb-org',
      project: 'sage',
      release: {
        name: version,
        deploy: {
          env: process.env.NODE_ENV || 'development',
        },
      },
    }),
  ],
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
    include: ['src/**/*.test.ts'],
    exclude: ['src/e2e/**/*.test.ts'],
    poolOptions: {
      forks: { singleFork: true }, // Make tests run sequentially
    },
    outputFile: {
      junit: './bin/test/junit.xml',
    },
    reporters: ['default', ...(process.env.CI === 'true' ? ['junit'] : [])],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '.mastra/',
        'bin/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
        '**/tests/**',
        '**/*.test.ts',
        '**/test-utils/**',
        'src/gql/generated/**',
        'src/evals/**',
        'src/e2e/**',
        'src/mastra/tests/**',
      ],
    },
  },
});

export default mergeConfig(viteConfig, vitestConfig);

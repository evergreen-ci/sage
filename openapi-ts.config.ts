import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  // Use patched local spec that fixes the Error schema to match actual API response
  // The actual API returns error.error (string) but the original spec incorrectly defines error.message
  input: './openapi-spec-patched.yaml',
  output: {
    path: 'src/generated/cursor-api',
    format: 'prettier',
  },
  plugins: [
    '@hey-api/typescript',
    {
      name: '@hey-api/sdk',
      operations: { strategy: 'single' },
    },
  ],
});

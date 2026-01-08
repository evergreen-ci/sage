import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'https://cursor.com/docs-static/cloud-agents-openapi.yaml',
  output: {
    path: 'src/services/cursor/generated',
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

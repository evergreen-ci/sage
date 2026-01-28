export default {
  // Run ESLint on TypeScript and JavaScript files
  '*.{ts,tsx,js,jsx}': ['pnpm eslint:strict'],
  // Run Prettier formatting check on all supported files
  '*.{ts,tsx,js,jsx,json,md}': ['pnpm format:check'],
};

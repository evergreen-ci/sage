module.exports = {
  // Run ESLint on TypeScript and JavaScript files
  '*.{ts,tsx,js,jsx}': ['yarn eslint:strict'],

  // Run Prettier formatting check on all supported files
  '*.{ts,tsx,js,jsx,json}': ['yarn format:check'],
};

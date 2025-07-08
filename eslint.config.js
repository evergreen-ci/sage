import eslint from '@eslint/js';
import disableConflictsPlugin from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import prettierConfig from 'eslint-plugin-prettier/recommended';
import sortDestructureKeysPlugin from 'eslint-plugin-sort-destructure-keys';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ERROR = 'error';
const WARN = 'warn';
const OFF = 'off';

const errorIfStrict = process.env.STRICT ? ERROR : WARN;

const globalIgnores = {
  name: 'Globally Ignored Files',
  ignores: [
    '**/bin',
    '**/dist',
    '**/node_modules',
    '**/coverage',
    '**/logs',
    '**/temp',
    '**/tmp',
    '**/build',
  ],
};

const languageOptions = {
  name: 'Language Options',
  languageOptions: {
    globals: {
      ...globals.node,
    },
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  settings: {
  },
};

// ESLint (@eslint/js) settings.
const eslintConfig = {
  name: '@eslint/js/rules',
  plugins: {
    '@eslint/js': eslint,
  },
  files: ['**/*.js?(x)', '**/*.ts?(x)'],
  rules: {
    ...eslint.configs.recommended.rules,
    'array-callback-return': [ERROR, { allowImplicit: true }],
    'arrow-body-style': [
      errorIfStrict,
      'as-needed',
      {
        requireReturnForObjectLiteral: false,
      },
    ],
    camelcase: [ERROR, { properties: 'never', ignoreDestructuring: false }],
    'consistent-return': OFF,
    curly: [errorIfStrict, 'multi-line'],
    'default-case': ERROR,
    'default-param-last': ERROR,
    'dot-notation': [ERROR, { allowKeywords: true }],
    eqeqeq: [errorIfStrict, 'always', { null: 'ignore' }],
    'no-await-in-loop': ERROR,
    'no-console': OFF,
    'no-debugger': errorIfStrict,
    'no-else-return': ERROR,
    'no-empty': [ERROR, { allowEmptyCatch: true }],
    'no-lonely-if': ERROR,
    'no-nested-ternary': ERROR,
    'no-new-wrappers': ERROR,
    'no-plusplus': [ERROR, { allowForLoopAfterthoughts: true }],
    'no-shadow': OFF, // Disabled for @typescript-eslint/no-shadow
    'no-undef': OFF, // TypeScript makes this rule irrelevant
    'no-undef-init': ERROR,
    'no-unneeded-ternary': ERROR,
    'no-unreachable-loop': ERROR,
    'no-unused-vars': OFF, // Disabled for @typescript-eslint/no-unused-vars
    'no-use-before-define': OFF, // Disabled for @typescript-eslint/no-use-before-define
    'no-useless-concat': ERROR,
    'no-var': ERROR,
    'operator-assignment': [ERROR, 'always'],
    'prefer-const': [ERROR, { destructuring: 'all' }],
    'prefer-destructuring': [
      ERROR,
      {
        VariableDeclarator: {
          array: false,
          object: true,
        },
        AssignmentExpression: {
          array: true,
          object: false,
        },
      },
      { enforceForRenamedProperties: false },
    ],
    'prefer-regex-literals': [ERROR, { disallowRedundantWrapping: true }],
    'prefer-template': ERROR,
    radix: ERROR,
    'spaced-comment': [ERROR, 'always', { markers: ['/'] }], // TODO: This rule is deprecated - fix in DEVPROD-15014.
    yoda: ERROR,
  },
};

// TypeScript ESLint (typescript-eslint) settings.
const tsEslintConfig = {
  name: 'typescript-eslint/rules',
  files: ['**/*.ts?(x)'],
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      project: ['./apps/*/tsconfig.json', './packages/*/tsconfig.json'],
      tsConfigRootDir: import.meta.url,
    },
  },
  plugins: {
    'typescript-eslint': tseslint,
  },
  rules: {
    '@typescript-eslint/ban-ts-comment': WARN,
    '@typescript-eslint/no-empty-object-type': WARN,
    '@typescript-eslint/no-explicit-any': WARN,
    '@typescript-eslint/no-namespace': OFF,

    // Rules for typescript-eslint. Note that these rules extend the ESLint rules. This can cause conflicts, so the original
    // ESLint rules above must be disabled for the following rules to work.
    '@typescript-eslint/no-shadow': ERROR,
    '@typescript-eslint/no-unused-vars': [
      errorIfStrict,
      {
        args: 'after-used',
        ignoreRestSiblings: true,
        vars: 'all',
        caughtErrors: 'none',
      },
    ],
    '@typescript-eslint/no-use-before-define': [
      ERROR,
      { functions: false, variables: false },
    ],
  },
};

// Sort Destructure Keys ESLint (eslint-plugin-sort-destructure-keys) settings.
const sortDestructureKeysConfig = {
  name: 'sort-destructure-keys/rules',
  files: ['src/**/*.ts?(x)'],
  plugins: {
    'sort-destructure-keys': sortDestructureKeysPlugin,
  },
  rules: {
    'sort-destructure-keys/sort-destructure-keys': [
      errorIfStrict,
      { caseSensitive: true },
    ],
  },
};

// JSDoc ESLint (eslint-plugin-jsdoc) settings.
const jsDocConfig = {
  ...jsdocPlugin.configs['flat/recommended-typescript-error'],
  name: 'jsdoc/rules',
  files: ['**/*.js?(x)', '**/*.ts?(x)'],
};

// Import ESLint (eslint-plugin-import) settings.
const importConfig = {
  ...importPlugin.flatConfigs.recommended,
  ...importPlugin.flatConfigs.typescript,
  name: 'import/rules',
  settings: {
    'import/resolver': {
      typescript: true,
      node: true,
    },
    'import/ignore': ['node_modules'],
  },
  rules: {
    ...importPlugin.flatConfigs.recommended.rules,
    ...importPlugin.flatConfigs.typescript.rules,
    'import/first': ERROR,
    'import/newline-after-import': WARN,
    'import/no-dynamic-require': ERROR,
    'import/no-duplicates': [ERROR, { 'prefer-inline': true }],
    'import/no-extraneous-dependencies': OFF,
    'import/no-unresolved': OFF,
    'import/no-useless-path-segments': ERROR,
    'import/order': [
      ERROR,
      {
        alphabetize: {
          caseInsensitive: true,
          order: 'asc',
        },
        groups: [
          'external',
          'builtin',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        pathGroups: [
          {
            group: 'external',
            pattern: '@**',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['react'],
      },
    ],
    'import/prefer-default-export': OFF,
  },
};

const disableConflictingPrettierRules = {
  ...disableConflictsPlugin,
  name: 'Disable Conflicting Rules for Prettier',
};

// Prettier ESLint (eslint-plugin-prettier) settings.
const prettierEsLintConfig = {
  ...prettierConfig,
  name: 'prettier/rules',
  rules: {
    'prettier/prettier': errorIfStrict,
  },
};

export default tseslint.config(
  globalIgnores,
  languageOptions,
  eslintConfig,
  tseslint.configs.recommended,
  tsEslintConfig,
  sortDestructureKeysConfig,
  jsDocConfig,
  importConfig,
  disableConflictingPrettierRules,
  // Prettier should be the last plugin.
  prettierEsLintConfig
);

export { ERROR, WARN, OFF, errorIfStrict };

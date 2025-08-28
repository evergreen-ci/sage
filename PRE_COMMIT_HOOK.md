# Pre-commit Hook with Husky

This project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks and [lint-staged](https://github.com/okonet/lint-staged) to run code quality checks on staged files before each commit.

## What it does

The pre-commit hook runs the following checks on staged files:

1. **TypeScript Compilation Check** (`yarn tsc --noEmit`)
   - Ensures all TypeScript code compiles without errors
   - Uses `--noEmit` flag to only check compilation without generating output files

2. **ESLint Strict Check** (`yarn eslint:strict`)
   - Runs ESLint with strict mode enabled (`STRICT=1`)
   - Enforces stricter linting rules that are treated as errors instead of warnings

3. **Prettier Format Check** (`yarn format:check`)
   - Ensures code is properly formatted according to Prettier rules

## How it works

- **Husky** manages the Git hooks and is configured in `.husky/pre-commit`
- **lint-staged** runs the checks only on files that are staged for commit (not the entire codebase)
- The configuration is in `.lintstagedrc.js`
- If any check fails, the commit will be blocked and you'll need to fix the issues before committing

## Manual execution

You can manually run the same checks:

```bash
# Run TypeScript compilation check
yarn tsc --noEmit

# Run ESLint strict check
yarn eslint:strict

# Run Prettier format check
yarn format:check

# Run lint-staged manually (same as pre-commit hook)
npx lint-staged
```

## Bypassing the hook (emergency only)

If you absolutely need to bypass the pre-commit hook in an emergency, you can use:

```bash
git commit --no-verify -m "Emergency commit message"
```

⚠️ **Warning**: Only use this in true emergencies. The pre-commit hook exists to maintain code quality.

## Setup for new developers

When a new developer clones the repository, the pre-commit hooks will be automatically installed when they run:

```bash
yarn install
```

This is because the `prepare` script in `package.json` runs `husky`, which sets up the Git hooks.

## Troubleshooting

If the pre-commit hook is failing:

1. Run `yarn tsc --noEmit` to check for TypeScript errors
2. Run `yarn eslint:strict` to check for linting errors
3. Run `yarn format:check` to check for formatting issues
4. Fix any issues found
5. Try committing again

The hook will provide clear error messages indicating which check failed and what needs to be fixed.

## Configuration files

- `.husky/pre-commit` - The pre-commit hook script
- `.lintstagedrc.js` - lint-staged configuration for running checks on staged files
- `package.json` - Contains the `prepare` script for Husky setup

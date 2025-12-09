# Release Notes Agent Testing Guide

This guide covers all ways to test the release notes agent.

## Test Types

1. **Unit Tests** - Fast, isolated tests for individual functions
2. **Braintrust Evals** - Evaluation against a dataset with scoring
3. **Manual Testing** - Interactive testing with custom inputs

## 1. Unit Tests

Unit tests verify core functionality like schema validation, section planning, and output normalization.

### Run All Unit Tests

```bash
yarn test src/mastra/agents/__tests__/releaseNotesAgent.test.ts
```

### Run with UI (Interactive)

```bash
yarn test:ui src/mastra/agents/__tests__/releaseNotesAgent.test.ts
```

### Run in Watch Mode

```bash
yarn test --watch src/mastra/agents/__tests__/releaseNotesAgent.test.ts
```

### Run Specific Test

```bash
yarn test src/mastra/agents/__tests__/releaseNotesAgent.test.ts -t "groups issues into the correct sections"
```

**What it tests:**

- `buildReleaseNotesSectionPlans` - Section planning logic
- `normalizeReleaseNotesOutput` - Output normalization and repair
- Schema validation
- Edge cases and error handling

## 2. Braintrust Evals

Braintrust evals test the agent against a dataset with real Jira issues and expected outputs, scoring for factuality and technical accuracy.

### Run Eval (Local, No Braintrust Upload)

```bash
yarn eval src/evals/releaseNotesAgent
```

### Run Eval and Send Results to Braintrust

```bash
yarn eval:send_to_braintrust src/evals/releaseNotesAgent
```

**Prerequisites:**

- `BRAINTRUST_API_KEY` environment variable must be set
- Dataset `product_release_notes_dataset` must exist in Braintrust with test cases

**What it tests:**

- End-to-end agent generation
- Factuality scoring (compares output to expected)
- Technical accuracy scoring
- Performance metrics (duration)

**Output:**

- Console output with scores
- XML report in `/bin` directory (JUnit format)
- Results sent to Braintrust (if using `eval:send_to_braintrust`)

## 3. Manual Testing

Manual testing allows you to test the agent with custom inputs interactively.

### Using the Test Script

```bash
# Run with default sample data
vite-node src/mastra/tests/scripts/test-release-notes-agent.ts

# Run with custom request file
vite-node src/mastra/tests/scripts/test-release-notes-agent.ts --request /path/to/input.json

# Write output to file
vite-node src/mastra/tests/scripts/test-release-notes-agent.ts --write /path/to/output.json

# Show section plan only
vite-node src/mastra/tests/scripts/test-release-notes-agent.ts --show-plan

# Custom sections
vite-node src/mastra/tests/scripts/test-release-notes-agent.ts --sections "Improvements,Bug Fixes,Security"
```

**Default Input:**
Uses `src/mastra/tests/data/sample-release-notes-input.json` if no `--request` flag is provided.

**What it tests:**

- Full agent generation with custom inputs
- Section planning visualization
- Output validation
- Schema compliance

### Using the API Directly

Start the dev server:

```bash
yarn dev
```

Then make a POST request:

```bash
curl -X POST http://localhost:8080/release-notes \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" \
  -d @src/mastra/tests/data/sample-release-notes-input.json
```

Or use the test data:

```bash
curl -X POST http://localhost:8080/release-notes \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" \
  -d @src/mastra/tests/data/release-notes-input-ops-manager-8.0.16.json
```

## Running All Tests

### Quick Test Suite

```bash
# Unit tests
yarn test src/mastra/agents/__tests__/releaseNotesAgent.test.ts

# Braintrust eval (if dataset is set up)
yarn eval src/evals/releaseNotesAgent
```

### Full Test Suite

```bash
# 1. Unit tests
yarn test src/mastra/agents/__tests__/releaseNotesAgent.test.ts

# 2. Type checking
yarn typecheck

# 3. Linting
yarn eslint:strict src/mastra/agents/releaseNotesAgent.ts src/api-server/routes/releaseNotes.ts

# 4. Format check
yarn format:check

# 5. Braintrust eval (requires BRAINTRUST_API_KEY)
yarn eval src/evals/releaseNotesAgent
```

## Test Data Files

- `src/mastra/tests/data/sample-release-notes-input.json` - Generic sample input
- `src/mastra/tests/data/release-notes-input-ops-manager-8.0.16.json` - Ops Manager 8.0.16 input

**Note:** Both files now include the `product` field (required for memory learning).

## Braintrust Dataset

The eval uses the `product_release_notes_dataset` dataset in Braintrust.

**To add test cases:**

1. Go to Braintrust UI
2. Navigate to the `product_release_notes_dataset` dataset
3. Add rows with:
   - `input`: Release notes input (with `product`, `jiraIssues`, etc.)
   - `expected`: Expected output structure
   - `metadata`: Test name, description, score thresholds

## Troubleshooting

### Unit Tests Failing

- Check that test data files include `product` field
- Verify schema changes haven't broken tests
- Run `yarn typecheck` to check for TypeScript errors

### Braintrust Eval Failing

- Verify `BRAINTRUST_API_KEY` is set
- Check that dataset `product_release_notes_dataset` exists
- Ensure dataset has test cases with proper structure
- Check that input includes `product` field

### Manual Testing Issues

- Ensure dev server is running (`yarn dev`)
- Check that input JSON includes required fields (`product`, `jiraIssues`)
- Verify MongoDB is running (for memory features)
- Check logs for detailed error messages

## Continuous Integration

Tests run automatically in CI:

- Unit tests run on every PR
- Braintrust evals can be run manually or on schedule
- Type checking and linting are enforced

## Next Steps

After running tests:

1. Review unit test results for any failures
2. Check Braintrust eval scores (aim for >0.7 factuality, >0.8 technical accuracy)
3. Review generated outputs for quality
4. Add more test cases to Braintrust dataset as needed

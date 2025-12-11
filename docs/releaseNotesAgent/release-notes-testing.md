# Release Notes Agent Testing Guide

## Braintrust Evals

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

**What it tests:**

- Full agent generation with custom inputs
- Section planning visualization
- Output validation
- Schema compliance

## Using the API Directly

Start the dev server:

```bash
yarn dev
```

Then make a POST request:

```bash
curl -X POST http://localhost:8080/release-notes \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user" \
  -d @path/to/input.json
```

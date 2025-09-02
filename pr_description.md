## Summary
Adds evaluation suite for log analyzer workflow with Braintrust integration and improves chunking strategy.

## Changes
- Added comprehensive evaluation suite (`src/evals/log_analyzer_suite.eval.ts`) to test log analyzer workflow performance
- Implemented "crop middle" chunking strategy to preserve important context at beginning/end of logs
- Simplified workflow configuration and removed hardcoded test values
- Enhanced data loader with configurable chunk sizes

## How to Run Evaluation

### 1. Required Data Setup (not included in PR)
Place MongoDB test failure logs in `test_data/eval_suite_loganalyzer/`

Create `test_cases_with_filenames.csv` with columns:
- Root cause description
- Difficulty level (Easy/Medium/Hard)
- Evidence string
- Task name
- Matched file name

### 2. Run the evaluation
```bash
npx braintrust eval src/evals/log_analyzer_suite.eval.ts
```

### 3. Results
- JSON report: `eval_results_log_analyzer.json`
- Markdown summary: `eval_results_log_analyzer.md`
- Braintrust dashboard for detailed metrics

## Metrics
- Root cause detection accuracy
- Factuality scores using AI-based evaluation
- Performance breakdown by difficulty level
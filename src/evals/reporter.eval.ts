import { Reporter, reportFailures } from 'braintrust';
import junit from 'junit-report-builder';
import path from 'path';
import { CustomEvalResult } from './types';

const FACTUALITY_PASS_CUTOFF = 0.4;
const LEVENSHTEIN_PASS_CUTOFF = 0.7;
const TOOL_USAGE_PASS_CUTOFF = 1.0;

const xmlBuilder = junit.newBuilder();
const suite = xmlBuilder.testSuite().name('Braintrust Evals');

// https://www.braintrust.dev/docs/guides/experiments/write#custom-reporters
// This is a custom reporter that controls how results are reported in CI.
// Braintrust will automatically detect and use this reporter.
Reporter('Evergreen CI reporter', {
  reportEval: async (evaluator, result, { jsonl, verbose }) => {
    const { results } = result;

    results.forEach(uncasted => {
      const r = uncasted as CustomEvalResult;

      const testCase = suite
        .testCase()
        .className(evaluator.evalName)
        .name(r.metadata.testName);
      testCase.time(r.output.duration / 1000);

      const factualityScore = r.scores.Factuality ?? 0;
      const levenshteinScore = r.scores.Levenshtein ?? 0;
      const toolUsageScore = r.scores?.['Tool Usage'] ?? 0;

      if (r.error || factualityScore < FACTUALITY_PASS_CUTOFF) {
        let message = '';
        if (r.error) {
          message += r.error?.toString();
        }
        if (factualityScore < FACTUALITY_PASS_CUTOFF) {
          message += `Factuality score ${factualityScore} is below threshold ${FACTUALITY_PASS_CUTOFF}`;
        }
        if (levenshteinScore < LEVENSHTEIN_PASS_CUTOFF) {
          message += `Levenshtein score ${levenshteinScore} is below threshold ${LEVENSHTEIN_PASS_CUTOFF}`;
        }
        if (toolUsageScore < TOOL_USAGE_PASS_CUTOFF) {
          message += `Tool Usage score ${toolUsageScore} is below threshold ${TOOL_USAGE_PASS_CUTOFF}`;
        }
        testCase.failure(message);
      }

      const tableResults = buildResultsTable({
        factualityScore,
        levenshteinScore,
        toolUsageScore,
      });
      console.log(r.metadata.testName);
      console.table(tableResults);
    });

    // Report any errors that occurred.
    const failingResults = results.filter(
      (r: { error: unknown }) => r.error !== undefined
    );
    if (failingResults.length > 0) {
      reportFailures(evaluator, failingResults, { verbose, jsonl });
    }
    return failingResults.length === 0;
  },
  reportRun: async (evalReports: boolean[]) => {
    xmlBuilder.writeTo(path.join(process.cwd(), '/bin/braintrust_evals.xml'));
    return evalReports.every(r => r);
  },
});

const buildResultsTable = ({
  factualityScore,
  levenshteinScore,
  toolUsageScore,
}: {
  factualityScore: number;
  levenshteinScore: number;
  toolUsageScore: number;
}) => ({
  Factuality: {
    actual: factualityScore,
    expected: `>= ${FACTUALITY_PASS_CUTOFF}`,
  },
  Levenshtein: {
    actual: levenshteinScore,
    expected: `>= ${LEVENSHTEIN_PASS_CUTOFF}`,
  },
  'Tool Usage': {
    actual: toolUsageScore,
    expected: `>= ${TOOL_USAGE_PASS_CUTOFF}`,
  },
});

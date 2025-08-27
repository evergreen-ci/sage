import { Reporter, reportFailures } from 'braintrust';
import junit from 'junit-report-builder';
import path from 'path';
import { CustomEvalResult, Thresholds } from './types';

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
      const toolUsageScore = r.scores?.['Tool Usage'] ?? 0;

      const factualityPassCutoff = r.metadata.thresholds.factuality;
      const toolUsagePassCutoff = r.metadata.thresholds.toolUsage;

      const failedFactuality = factualityScore < factualityPassCutoff;
      const failedToolUsage = toolUsageScore < toolUsagePassCutoff;

      if (r.error || failedFactuality || failedToolUsage) {
        const messages: string[] = [];
        if (r.error) {
          messages.push(r.error?.toString());
        }
        if (failedFactuality) {
          messages.push(
            `Factuality score ${factualityScore} is below threshold ${factualityPassCutoff}`
          );
        }
        if (failedToolUsage) {
          messages.push(
            `Tool Usage score ${toolUsageScore} is below threshold ${toolUsagePassCutoff}`
          );
        }
        testCase.failure(messages.join('\n'));
      }

      printResultsTable({
        factualityScore,
        toolUsageScore,
        thresholds: r.metadata.thresholds,
        testName: r.metadata.testName,
      });
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

const printResultsTable = ({
  factualityScore,
  testName,
  thresholds,
  toolUsageScore,
}: {
  factualityScore: number;
  toolUsageScore: number;
  thresholds: Thresholds;
  testName: string;
}) => {
  const resultsTable = {
    Factuality: {
      actual: factualityScore,
      expected: `>= ${thresholds.factuality}`,
    },
    'Tool Usage': {
      actual: toolUsageScore,
      expected: `>= ${thresholds.toolUsage}`,
    },
  };
  console.log(testName);
  console.table(resultsTable);
};

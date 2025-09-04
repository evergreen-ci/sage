import { Reporter, reportFailures } from 'braintrust';
import junit from 'junit-report-builder';
import path from 'path';
import { ReporterEvalResult } from './types';

export const getReporter = <Input, Output, Metadata, Scores, Thresholds>({
  calculateScores,
  printResults,
  reporterName,
  testSuiteName,
  xmlFileOutputName,
}: {
  calculateScores: (scores: Scores, scoreThresholds: Thresholds) => string[];
  printResults: (
    scores: Scores,
    scoreThresholds: Thresholds,
    testName: string
  ) => void;
  reporterName: string;
  testSuiteName: string;
  xmlFileOutputName: string;
}) => {
  const xmlBuilder = junit.newBuilder();
  const testSuite = xmlBuilder.testSuite().name(testSuiteName);

  const reporter = Reporter(reporterName, {
    reportEval: async (evaluator, result, { jsonl, verbose }) => {
      const { results } = result;

      // Check that minimum score thresholds have been met.
      results.forEach(uncasted => {
        const r = uncasted as ReporterEvalResult<
          Input,
          Output,
          Metadata,
          Scores,
          Thresholds
        >;

        const testCase = testSuite
          .testCase()
          .className(testSuiteName)
          .name(r.metadata.testName);

        testCase.time(r.output.duration / 1000);

        const messages: string[] = [];
        if (r.error) {
          messages.push(r.error?.toString());
        }

        const scoreErrors = calculateScores(
          r.scores,
          r.metadata.scoreThresholds
        );
        messages.push(...scoreErrors);

        if (messages.length > 0) {
          testCase.failure(messages.join('\n'));
        }

        printResults(r.scores, r.metadata.scoreThresholds, r.metadata.testName);
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
      xmlBuilder.writeTo(
        path.join(process.cwd(), `/bin/${xmlFileOutputName}.xml`)
      );
      return evalReports.every(r => r);
    },
  });

  return reporter;
};

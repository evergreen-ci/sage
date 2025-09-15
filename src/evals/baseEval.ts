import { Reporter, reportFailures } from 'braintrust';
import junit from 'junit-report-builder';
import path from 'path';
import { ReporterEvalResult, Scores } from './types';

/**
 * Configuration for creating a base eval reporter
 * @template TInput Type of input for the evaluation
 * @template TOutput Type of output for the evaluation
 * @template TScores Type of scores used in the evaluation
 */
export interface BaseEvalConfig<TScores extends Scores> {
  /** Name of the reporter */
  reporterName: string;
  /** Name of the test suite */
  testSuiteName: string;
  /** Name of the XML output file */
  xmlFileOutputName: string;
  /** Function to calculate scores and generate error messages */
  calculateScores: (scores: TScores, scoreThresholds: TScores) => string[];
  /** Function to print evaluation results */
  printResults: (
    scores: TScores,
    scoreThresholds: TScores,
    testName: string
  ) => void;
}

/**
 * Create a base eval reporter for consistent evaluation across different agents
 * @param config - Configuration for the eval reporter
 * @param config.calculateScores Function to calculate scores and generate error messages
 * @param config.printResults Function to print evaluation results
 * @param config.reporterName Name of the reporter
 * @param config.testSuiteName Name of the test suite
 * @param config.xmlFileOutputName Name of the XML output file
 * @template TOutput Type of output for the evaluation
 * @template TScores Type of scores used in the evaluation
 * @returns A configured Braintrust reporter
 */
export const createBaseEvalReporter = <
  TInput,
  TOutput,
  TScores extends Scores,
>({
  calculateScores,
  printResults,
  reporterName,
  testSuiteName,
  xmlFileOutputName,
}: BaseEvalConfig<TScores>) => {
  const xmlBuilder = junit.newBuilder();
  const testSuite = xmlBuilder.testSuite().name(testSuiteName);

  const reporter = Reporter(reporterName, {
    reportEval: async (evaluator, result, { jsonl, verbose }) => {
      const { results } = result;

      // Process each evaluation result
      results.forEach(uncasted => {
        const r = uncasted as ReporterEvalResult<TInput, TOutput, TScores>;

        const testCase = testSuite
          .testCase()
          .className(testSuiteName)
          .name(r.metadata.testName);

        // Record test duration
        testCase.time(r.output.duration / 1000);

        // Collect error messages
        const messages: string[] = [];
        if (r.error) {
          messages.push(r.error?.toString());
        }

        // Calculate and add score-related error messages
        const scoreErrors = calculateScores(
          r.scores,
          r.metadata.scoreThresholds
        );
        messages.push(...scoreErrors);

        // Mark test case as failed if there are messages
        if (messages.length > 0) {
          testCase.failure(messages.join('\n'));
        }

        // Print results using provided print function
        printResults(r.scores, r.metadata.scoreThresholds, r.metadata.testName);
      });

      // Report any errors that occurred
      const failingResults = results.filter(
        (r: { error: unknown }) => r.error !== undefined
      );
      if (failingResults.length > 0) {
        reportFailures(evaluator, failingResults, { verbose, jsonl });
      }
      return failingResults.length === 0;
    },
    reportRun: async (evalReports: boolean[]) => {
      // Write XML report to file
      xmlBuilder.writeTo(
        path.join(process.cwd(), `/bin/${xmlFileOutputName}.xml`)
      );
      return evalReports.every(r => r);
    },
  });

  return reporter;
};

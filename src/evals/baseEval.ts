import { Reporter, reportFailures } from 'braintrust';
import junit, { TestSuite as JUnitTestSuite } from 'junit-report-builder';
import path from 'path';
import { ReporterEvalResult, ScorerFunction, Scores } from './types';

/**
 * Configuration for creating a base eval reporter
 * @template TInput Type of input for the evaluation
 * @template TOutput Type of output for the evaluation
 * @template TScores Type of scores used in the evaluation
 */
export interface BaseEvalConfig<
  TScores extends Scores,
  TOutput extends string | object,
> {
  /** Name of the reporter */
  reporterName: string;
  /** Name of the test suite */
  testSuiteName: string;
  /** Name of the XML output file */
  xmlFileOutputName: string;
  /** Function to calculate scores and generate error messages */
  calculateScores: ScorerFunction<TScores, TOutput>;
  /** Function to print evaluation results */
  printResults?: (result: ReporterEvalResult<unknown, unknown, any>) => void;
}

/**
 * Create a base eval reporter for consistent evaluation across different agents
 * @param config - Configuration for the eval reporter
 * @param config.calculateScores Function to calculate scores and generate error messages
 * @param config.printResults Optional function to print evaluation results (defaults to defaultPrintResults)
 * @param config.reporterName Name of the reporter
 * @param config.testSuiteName Name of the test suite
 * @param config.xmlFileOutputName Name of the XML output file
 * @template TOutput Type of output for the evaluation
 * @template TScores Type of scores used in the evaluation
 * @returns A configured Braintrust reporter
 */
export const createBaseEvalReporter = <
  TOutput extends string | object,
  TScores extends Scores,
>({
  calculateScores,
  printResults = defaultPrintResults,
  reporterName,
  testSuiteName,
  xmlFileOutputName,
}: BaseEvalConfig<TScores, TOutput>) => {
  const xmlBuilder = junit.newBuilder();
  const testSuite = xmlBuilder.testSuite().name(testSuiteName);

  const reporter = Reporter(reporterName, {
    // Report Eval generates a result for each test case
    reportEval: async (evaluator, result, { jsonl, verbose }) => {
      const { results: uncastedResults } = result;
      const results = uncastedResults as ReporterEvalResult<
        unknown,
        unknown,
        any
      >[];

      // Process each evaluation result and generate an XML report for each test case
      results.forEach(r => {
        if (r.metadata === undefined) {
          throw new Error(
            'Metadata is undefined did you wrap your agent call in a Tracer?'
          );
        }
        buildTestCase(testSuite, testSuiteName, r, calculateScores);
        // Print results using provided print function
        printResults(r);
      });

      // Report any errors that occurred
      const failingResults = results.filter(r => r.error !== undefined);
      if (failingResults.length > 0) {
        reportFailures(evaluator, failingResults as any, { verbose, jsonl });
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

/**
 * Default function to print evaluation results
 * @param result - The result to print
 */
const defaultPrintResults = <TScores extends Scores>(
  result: ReporterEvalResult<unknown, unknown, TScores>
) => {
  console.log(`Eval for ${result.metadata.testName}:`);

  // Create a table with actual and expected columns for each score
  const resultsTable = Object.entries(result.scores).reduce(
    (acc, [key, value]) => {
      acc[key] = {
        actual: value,
        expected: `>= ${result.metadata.scoreThresholds[key]}`,
      };
      return acc;
    },
    {} as Record<string, { actual: number; expected: string }>
  );

  console.table(resultsTable);
};

const buildTestCase = (
  testSuite: JUnitTestSuite,
  testSuiteName: string,
  testResult: ReporterEvalResult<unknown, unknown, any>,
  calculateScores: ScorerFunction<any, any>
) => {
  const testCase = testSuite
    .testCase()
    .className(testSuiteName)
    .name(testResult.metadata.testName);

  // Record test duration
  testCase.time(testResult.output.duration / 1000);

  // Collect error messages
  const messages: string[] = [];
  if (testResult.error) {
    messages.push(testResult.error?.toString());
  }

  // Calculate and add score-related error messages
  const scoreErrors = calculateScores(testResult.scores);
  messages.push(...scoreErrors);

  // Mark test case as failed if there are messages
  if (messages.length > 0) {
    testCase.failure(messages.join('\n'));
  }
  return testCase;
};

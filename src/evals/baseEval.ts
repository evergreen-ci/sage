import path from 'path';
import { Reporter, reportFailures } from 'braintrust';
import junit, { TestSuite as JUnitTestSuite } from 'junit-report-builder';
import {
  BaseTestCase,
  ReporterEvalResult,
  ScorerFunction,
  BaseScores,
} from './types';

/**
 * Configuration for creating a base eval reporter
 * @template TInput Type of input for the evaluation
 * @template TOutput Type of output for the evaluation
 * @template TScores Type of scores used in the evaluation
 */
export interface BaseEvalConfig<
  TestCase extends BaseTestCase<unknown, object, BaseScores>,
> {
  reporterName: string;
  testSuiteName: string;
  xmlFileOutputName: string;
  calculateScores: ScorerFunction<
    TestCase['metadata']['scoreThresholds'],
    TestCase['expected']
  >;
  printResults?: (result: ReporterEvalResult<TestCase>) => void;
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
  TestCase extends BaseTestCase<unknown, object, BaseScores>,
>({
  calculateScores,
  printResults = defaultPrintResults,
  reporterName,
  testSuiteName,
  xmlFileOutputName,
}: BaseEvalConfig<TestCase>) => {
  const xmlBuilder = junit.newBuilder();
  const testSuite = xmlBuilder.testSuite().name(testSuiteName);

  const reporter = Reporter(reporterName, {
    reportEval: async (evaluator, result, { jsonl, verbose }) => {
      const { results: uncastedResults } = result;
      const results = uncastedResults as ReporterEvalResult<TestCase>[];

      results.forEach(r => {
        if (r.metadata === undefined) {
          throw new Error(
            'Metadata is undefined. Did you wrap your agent call in a Tracer?'
          );
        }
        buildTestCase(testSuite, testSuiteName, r, calculateScores);
        printResults(r);
      });

      const failingResults = results.filter(r => r.error !== undefined);
      if (failingResults.length > 0) {
        reportFailures(evaluator, failingResults as any, { verbose, jsonl });
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

/**
 * Default function to print evaluation results
 * @param result - The result to print
 */
const defaultPrintResults = <
  TestCase extends BaseTestCase<unknown, object, BaseScores>,
>(
  result: ReporterEvalResult<TestCase>
) => {
  console.log(`Eval for ${result.metadata.testName}:`);

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

const buildTestCase = <
  TestCase extends BaseTestCase<unknown, object, BaseScores>,
>(
  testSuite: JUnitTestSuite,
  testSuiteName: string,
  testResult: ReporterEvalResult<TestCase>,
  calculateScores: ScorerFunction<
    TestCase['metadata']['scoreThresholds'],
    TestCase['expected']
  >
) => {
  const testCase = testSuite
    .testCase()
    .className(testSuiteName)
    .name(testResult.metadata.testName);

  testCase.time(testResult.output.duration / 1000);

  const messages: string[] = [];
  if (testResult.error) {
    messages.push(testResult.error?.toString());
  }

  const scoreErrors = calculateScores(
    testResult.scores,
    testResult.metadata.scoreThresholds,
    {
      output: testResult.output,
      expected: testResult.expected,
    }
  );
  messages.push(...scoreErrors);

  if (messages.length > 0) {
    testCase.failure(messages.join('\n'));
  }
  return testCase;
};

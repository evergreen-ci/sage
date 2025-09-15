import { ReporterName } from 'evals/constants';
import { getReporter } from 'evals/reporter.eval';
import { TestInput, TestResult, Scores } from './types';

const calculateScores = (
  scores: Scores,
  scoreThresholds: Scores,
  results: {
    expected: TestResult;
    output: TestResult;
  }
) => {
  const factualityScore = scores.Factuality;
  const technicalAccuracyScore = scores.TechnicalAccuracy;
  const factualityPassCutoff = scoreThresholds.Factuality;
  const technicalAccuracyPassCutoff = scoreThresholds.TechnicalAccuracy;

  const messages: string[] = [];
  if (factualityScore < factualityPassCutoff) {
    messages.push(
      `Factuality score ${factualityScore} is below threshold ${factualityPassCutoff}.`
    );
  }
  if (technicalAccuracyScore < technicalAccuracyPassCutoff) {
    const message = `Technical Accuracy score ${technicalAccuracyScore} is below threshold ${technicalAccuracyPassCutoff}.`;
    const expected = results.expected.summary;
    const output = results.output.summary;

    messages.push(`Expected: ${expected}\nOutput: ${output}\n${message}`);
  }
  return messages;
};

const printResults = (
  scores: Scores,
  scoreThresholds: Scores,
  testName: string
) => {
  const resultsTable = {
    Factuality: {
      actual: scores.Factuality,
      expected: `>= ${scoreThresholds.Factuality}`,
    },
    TechnicalAccuracy: {
      actual: scores.TechnicalAccuracy,
      expected: `>= ${scoreThresholds.TechnicalAccuracy}`,
    },
  };
  console.log(testName);
  console.table(resultsTable);
};

getReporter<TestInput, TestResult, Scores>({
  calculateScores,
  printResults,
  reporterName: ReporterName.LogAnalyzerWorkflow,
  testSuiteName: 'Log Analyzer Workflow Evals',
  xmlFileOutputName: 'log_analyzer_workflow_evals',
});

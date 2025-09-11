import { ReporterName } from 'evals/constants';
import { getReporter } from 'evals/reporter.eval';
import { TestInput, TestResult, Scores } from './types';

const calculateScores = (scores: Scores, scoreThresholds: Scores) => {
  const factualityScore = scores.Factuality;
  const factualityPassCutoff = scoreThresholds.Factuality;

  const messages: string[] = [];
  if (factualityScore < factualityPassCutoff) {
    messages.push(
      `Factuality score ${factualityScore} is below threshold ${factualityPassCutoff}.`
    );
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

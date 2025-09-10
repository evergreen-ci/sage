import { ReporterName } from 'evals/constants';
import { getReporter } from 'evals/reporter.eval';
import { TestInput, TestResult, Scores } from './types';

const calculateScores = (scores: Scores, scoreThresholds: Scores) => {
  const factualityScore = scores.Factuality;
  const toolUsageScore = scores.ToolUsage;

  const factualityPassCutoff = scoreThresholds.Factuality;
  const toolUsagePassCutoff = scoreThresholds.ToolUsage;

  const messages: string[] = [];
  if (factualityScore < factualityPassCutoff) {
    messages.push(
      `Factuality score ${factualityScore} is below threshold ${factualityPassCutoff}.`
    );
  }
  if (toolUsageScore < toolUsagePassCutoff) {
    messages.push(
      `Tool Usage score ${toolUsageScore} is below threshold ${toolUsagePassCutoff}.`
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
    'Tool Usage': {
      actual: scores.ToolUsage,
      expected: `>= ${scoreThresholds.ToolUsage}`,
    },
  };
  console.log(testName);
  console.table(resultsTable);
};

getReporter<TestInput, TestResult, Scores>({
  calculateScores,
  printResults,
  reporterName: ReporterName.Evergreen,
  testSuiteName: 'Evergreen Evals',
  xmlFileOutputName: 'evergreen_evals',
});

import { ReporterName } from 'evals/constants';
import { getReporter } from 'evals/reporter.eval';
import {
  TestInput,
  TestResult,
  TestMetadata,
  Thresholds,
  Scores,
} from './types';

const calculateScores = (scores: Scores, scoreThresholds: Thresholds) => {
  const factualityScore = scores.Factuality;
  const toolUsageScore = scores['Tool Usage'];

  const factualityPassCutoff = scoreThresholds.factuality;
  const toolUsagePassCutoff = scoreThresholds.toolUsage;

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
  scoreThresholds: Thresholds,
  testName: string
) => {
  const resultsTable = {
    Factuality: {
      actual: scores.Factuality,
      expected: `>= ${scoreThresholds.factuality}`,
    },
    'Tool Usage': {
      actual: scores['Tool Usage'],
      expected: `>= ${scoreThresholds.toolUsage}`,
    },
  };
  console.log(testName);
  console.table(resultsTable);
};

getReporter<TestInput, TestResult, TestMetadata, Scores, Thresholds>({
  calculateScores,
  printResults,
  reporterName: ReporterName.Evergreen,
  testSuiteName: 'Evergreen Evals',
  xmlFileOutputName: 'evergreen_evals',
});

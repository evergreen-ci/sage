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
  const exactMatchScore = scores.ExactMatch;
  const exactMatchCutoff = scoreThresholds.exactMatch;
  const messages: string[] = [];
  if (exactMatchScore < exactMatchCutoff) {
    messages.push(
      `Exact Match score ${exactMatchScore} is below threshold ${exactMatchCutoff}.`
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
    ExactMatch: {
      actual: scores.ExactMatch,
      expected: scoreThresholds.exactMatch,
    },
  };
  console.log(testName);
  console.table(resultsTable);
};

getReporter<TestInput, TestResult, TestMetadata, Scores, Thresholds>({
  calculateScores,
  printResults,
  reporterName: ReporterName.QuestionClassifier,
  testSuiteName: 'Question Classifier Evals',
  xmlFileOutputName: 'question_classifier_evals',
});

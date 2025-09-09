import { ReporterName } from 'evals/constants';
import { getReporter } from 'evals/reporter.eval';
import { TestInput, TestResult, TestMetadata, Scores } from './types';

const calculateScores = (scores: Scores, scoreThresholds: Scores) => {
  const exactMatchScore = scores.ExactMatch;
  const exactMatchCutoff = scoreThresholds.ExactMatch;
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
  scoreThresholds: Scores,
  testName: string
) => {
  const resultsTable = {
    'Exact Match': {
      actual: scores.ExactMatch,
      expected: scoreThresholds.ExactMatch,
    },
  };
  console.log(testName);
  console.table(resultsTable);
};

getReporter<TestInput, TestResult, TestMetadata, Scores>({
  calculateScores,
  printResults,
  reporterName: ReporterName.QuestionClassifier,
  testSuiteName: 'Question Classifier Evals',
  xmlFileOutputName: 'question_classifier_evals',
});

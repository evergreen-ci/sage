import { createBaseEvalReporter } from '../baseEval';
import { ReporterName } from '../constants';
import { createScoreChecker } from '../scorers';

/**
 * Create configuration for Question Classifier Agent evaluation
 * @returns Configured eval reporter
 */
const createEvalConfig = () => ({
  reporterName: ReporterName.QuestionClassifier,
  testSuiteName: 'Question Classifier Evals',
  xmlFileOutputName: 'question_classifier_evals',
  calculateScores: createScoreChecker({
    ExactMatch: 0.8,
  }),
  printResults: (
    scores: { ExactMatch: number },
    thresholds: { ExactMatch: number },
    testName: string
  ) => {
    console.log(
      `Eval for ${testName}:`,
      `Exact Match: ${scores.ExactMatch}, Threshold: ${thresholds.ExactMatch}`
    );
  },
});

/**
 * Question Classifier Agent evaluation reporter
 */
export const reporter = createBaseEvalReporter(createEvalConfig());

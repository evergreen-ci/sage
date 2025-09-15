import { BaseEvalConfig, createBaseEvalReporter } from '../baseEval';
import { ReporterName } from '../constants';
import { createScoreChecker } from '../scorers';

/**
 * Create configuration for Question Classifier Agent evaluation
 * @returns Configured eval reporter
 */
const createEvalConfig = (): BaseEvalConfig<{
  ExactMatch: number;
}> => ({
  reporterName: ReporterName.QuestionClassifier,
  testSuiteName: 'Question Classifier Evals',
  xmlFileOutputName: 'question_classifier_evals',
  calculateScores: createScoreChecker({
    ExactMatch: 0.8,
  }),
});

/**
 * Question Classifier Agent evaluation reporter
 */
export const reporter = createBaseEvalReporter(createEvalConfig());

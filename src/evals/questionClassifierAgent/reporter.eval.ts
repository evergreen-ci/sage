import { BaseEvalConfig, createBaseEvalReporter } from '../baseEval';
import { ReporterName } from '../constants';
import { createScoreChecker } from '../scorers';
import { TestResult } from './types';

/**
 * Create configuration for Question Classifier Agent evaluation
 * @returns Configured eval reporter
 */
const createEvalConfig = (): BaseEvalConfig<
  {
    ExactMatch: number;
  },
  TestResult
> => ({
  reporterName: ReporterName.QuestionClassifier,
  testSuiteName: 'Question Classifier Evals',
  xmlFileOutputName: 'question_classifier_evals',
  calculateScores: createScoreChecker,
});

/**
 * Question Classifier Agent evaluation reporter
 */
export const reporter = createBaseEvalReporter(createEvalConfig());

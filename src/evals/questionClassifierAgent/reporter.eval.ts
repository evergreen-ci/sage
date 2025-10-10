import { BaseEvalConfig, createBaseEvalReporter } from '@/evals/baseEval';
import { ReporterName } from '@/evals/constants';
import { createScoreChecker } from '@/evals/scorers';
import { TestCase } from './types';

const createEvalConfig = (): BaseEvalConfig<TestCase> => ({
  reporterName: ReporterName.QuestionClassifier,
  testSuiteName: 'Question Classifier Evals',
  xmlFileOutputName: 'question_classifier_evals',
  calculateScores: createScoreChecker,
});

export const reporter = createBaseEvalReporter(createEvalConfig());

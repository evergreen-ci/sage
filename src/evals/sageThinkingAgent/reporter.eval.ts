import { BaseEvalConfig, createBaseEvalReporter } from '../baseEval';
import { ReporterName } from '../constants';
import { createScoreChecker } from '../scorers';
import { TestCase } from './types';

const createEvalConfig = (): BaseEvalConfig<TestCase> => ({
  reporterName: ReporterName.SageThinking,
  testSuiteName: 'Sage Thinking Evals',
  xmlFileOutputName: 'sage_thinking_evals',
  calculateScores: createScoreChecker,
});

export const reporter = createBaseEvalReporter(createEvalConfig());

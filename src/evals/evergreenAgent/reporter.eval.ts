import { BaseEvalConfig, createBaseEvalReporter } from '../baseEval';
import { ReporterName } from '../constants';
import { createScoreChecker } from '../scorers';
import { TestCase } from './types';

const createEvalConfig = (): BaseEvalConfig<TestCase> => ({
  reporterName: ReporterName.Evergreen,
  testSuiteName: 'Evergreen Evals',
  xmlFileOutputName: 'evergreen_evals',
  calculateScores: createScoreChecker,
});

export const reporter = createBaseEvalReporter(createEvalConfig());

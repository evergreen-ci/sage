import { BaseEvalConfig, createBaseEvalReporter } from '../baseEval';
import { ReporterName } from '../constants';
import { createScoreChecker } from '../scorers';
import { TestCase } from './types';

/**
 * Create configuration for Evergreen Agent evaluation
 * @returns Configured eval reporter
 */
const createEvalConfig = (): BaseEvalConfig<TestCase> => ({
  reporterName: ReporterName.Evergreen,
  testSuiteName: 'Evergreen Evals',
  xmlFileOutputName: 'evergreen_evals',
  calculateScores: createScoreChecker,
});

/**
 * Evergreen Agent evaluation reporter
 */
export const reporter = createBaseEvalReporter(createEvalConfig());

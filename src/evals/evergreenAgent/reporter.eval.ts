import { BaseEvalConfig, createBaseEvalReporter } from '../baseEval';
import { ReporterName } from '../constants';
import { createScoreChecker } from '../scorers';

/**
 * Create configuration for Evergreen Agent evaluation
 * @returns Configured eval reporter
 */
const createEvalConfig = (): BaseEvalConfig<{
  Factuality: number;
  ToolUsage: number;
}> => ({
  reporterName: ReporterName.Evergreen,
  testSuiteName: 'Evergreen Evals',
  xmlFileOutputName: 'evergreen_evals',
  calculateScores: createScoreChecker({
    Factuality: 0.7,
    ToolUsage: 0.8,
  }),
});

/**
 * Evergreen Agent evaluation reporter
 */
export const reporter = createBaseEvalReporter(createEvalConfig());

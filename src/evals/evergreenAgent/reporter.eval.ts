import { createBaseEvalReporter } from '../baseEval';
import { ReporterName } from '../constants';
import { createScoreChecker } from '../scorers';

/**
 * Create configuration for Evergreen Agent evaluation
 * @returns Configured eval reporter
 */
const createEvalConfig = () => ({
  reporterName: ReporterName.Evergreen,
  testSuiteName: 'Evergreen Evals',
  xmlFileOutputName: 'evergreen_evals',
  calculateScores: createScoreChecker({
    Factuality: 0.7,
    ToolUsage: 0.8,
  }),
  printResults: (
    scores: { Factuality: number; ToolUsage: number },
    thresholds: { Factuality: number; ToolUsage: number },
    testName: string
  ) => {
    console.log(
      `Eval for ${testName}:`,
      `Factuality: ${scores.Factuality}, Threshold: ${thresholds.Factuality}`,
      `Tool Usage: ${scores.ToolUsage}, Threshold: ${thresholds.ToolUsage}`
    );
  },
});

/**
 * Evergreen Agent evaluation reporter
 */
export const reporter = createBaseEvalReporter(createEvalConfig());

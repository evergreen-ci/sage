import { BaseEvalConfig, createBaseEvalReporter } from 'evals/baseEval';
import { ReporterName } from 'evals/constants';
import { createScoreChecker } from 'evals/scorers';
import { TestCase } from './types';

const createEvalConfig = (): BaseEvalConfig<TestCase> => ({
  reporterName: ReporterName.LogAnalyzerWorkflow,
  testSuiteName: 'Log Analyzer Workflow Eval',
  xmlFileOutputName: 'log_analyzer_workflow_eval',
  calculateScores: createScoreChecker,
});

export const reporter = createBaseEvalReporter(createEvalConfig());

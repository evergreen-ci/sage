import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import z from 'zod';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { TechnicalAccuracy } from '@/evals/scorers';
import { tracedWorkflowEval } from '@/evals/utils/tracedWorkflow';
import { LOG_ANALYZER_WORKFLOW_NAME } from '@/mastra/agents/constants';
import { logCoreAnalyzerWorkflow } from '@/mastra/workflows/logCoreAnalyzer';
import { getTestCases } from './testCases';
import { TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: getTestCases(),
    task: tracedWorkflowEval<
      TestInput,
      TestResult,
      z.infer<typeof logCoreAnalyzerWorkflow.inputSchema>
    >({
      workflowName: LOG_ANALYZER_WORKFLOW_NAME,
      transformInput: async input => {
        try {
          const text = await input.file.data().then(data => data.text());
          return {
            text,
            analysisContext: input.analysisContext,
          };
        } catch (err) {
          throw new Error(
            `Failed to read file "${input.file.reference?.filename ?? 'unknown'}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      },
    }),
    scores: [
      ({ expected, input, output }) =>
        Factuality({
          expected: expected.summary,
          output: output.output.summary,
          input: input.file.reference.filename,
        }),
      ({ expected, output }) =>
        TechnicalAccuracy({
          output: output.output.summary,
          expected: expected.summary,
        }),
    ],
    experimentName: 'Log Analyzer Workflow Eval',
    description: 'Tests for the Log Analyzer Workflow.',
    maxConcurrency: 2,
  },
  {
    reporter: ReporterName.LogAnalyzerWorkflow,
  }
);

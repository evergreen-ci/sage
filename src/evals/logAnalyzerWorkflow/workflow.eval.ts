import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import z from 'zod';
import { ReporterName, PROJECT_NAME } from 'evals/constants';
import { tracedWorkflowEval } from 'evals/utils/tracedWorkflow';
import { LOG_ANALYZER_WORKFLOW_NAME } from 'mastra/agents/constants';
import { logCoreAnalyzerWorkflow } from 'mastra/workflows/logCoreAnalyzerWorkflow';
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
      transformInput: async input => ({
        text: await input.file.data().then(data => data.text()),
        analysisContext: input.analysisContext,
      }),
    }),
    scores: [
      ({ expected, input, output }) =>
        Factuality({
          expected: expected.summary,
          output: output.summary,
          input: input.file.reference.filename,
        }),
    ],
    experimentName: 'Log Analyzer Workflow Eval',
    description: 'Tests for the Log Analyzer Workflow.',
  },
  {
    reporter: ReporterName.LogAnalyzerWorkflow,
  }
);

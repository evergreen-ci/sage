import { Factuality } from 'autoevals';
import { Eval, initDataset } from 'braintrust';
import z from 'zod';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { TechnicalAccuracy } from '@/evals/scorers';
import { tracedWorkflowEval } from '@/evals/utils/tracedWorkflow';
import { RELEASE_NOTES_WORKFLOW_NAME } from '@/mastra/agents/constants';
import { releaseNotesWorkflow } from '@/mastra/workflows/releaseNotes';
import { TestCase, TestInput, TestResult } from './types';

const loadReleaseNotesTestCases = async (): Promise<TestCase[]> => {
  const dataset = initDataset(PROJECT_NAME, {
    dataset: 'product_release_notes_dataset',
  });
  const testCases: TestCase[] = [];
  for await (const row of dataset) {
    // Transform the row to ensure it has the required metadata structure
    const testCase: TestCase = {
      input: row.input as TestInput,
      expected: row.expected as TestResult,
      metadata: {
        testName:
          (row.metadata as { testName?: string })?.testName ||
          `Release Notes - ${(row.metadata as { product?: string })?.product || 'unknown'} ${(row.metadata as { version?: string })?.version || ''}`.trim(),
        description:
          (row.metadata as { description?: string })?.description ||
          `Release notes for ${(row.metadata as { product?: string })?.product || 'unknown'} ${(row.metadata as { version?: string })?.version || ''}`.trim(),
        scoreThresholds: {
          Factuality:
            (row.metadata as { scoreThresholds?: { Factuality?: number } })
              ?.scoreThresholds?.Factuality ?? 0.7,
          TechnicalAccuracy:
            (
              row.metadata as {
                scoreThresholds?: { TechnicalAccuracy?: number };
              }
            )?.scoreThresholds?.TechnicalAccuracy ?? 0.8,
        },
      },
    };
    testCases.push(testCase);
  }
  console.log(`Loaded ${testCases.length} test cases from Braintrust`);
  return testCases;
};

Eval(
  PROJECT_NAME,
  {
    data: loadReleaseNotesTestCases(),
    task: tracedWorkflowEval<
      TestInput,
      TestResult,
      z.infer<typeof releaseNotesWorkflow.inputSchema>
    >({
      workflowName: RELEASE_NOTES_WORKFLOW_NAME,
    }),
    scores: [
      ({ expected, input, output }) =>
        Factuality({
          expected: JSON.stringify(expected, null, 2),
          output: JSON.stringify(output, null, 2),
          input: JSON.stringify(input, null, 2),
        }),
      ({ expected, output }) =>
        TechnicalAccuracy({
          output: JSON.stringify(output, null, 2),
          expected: JSON.stringify(expected, null, 2),
        }),
    ],
    experimentName: 'Release Notes Workflow Eval',
    description: 'Tests for the Release Notes workflow.',
  },
  {
    reporter: ReporterName.ReleaseNotes,
  }
);

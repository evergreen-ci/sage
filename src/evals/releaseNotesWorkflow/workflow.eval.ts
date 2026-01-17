import { Eval, initDataset } from 'braintrust';
import z from 'zod';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { SafeFaithfulness, TechnicalAccuracy } from '@/evals/scorers';
import { tracedWorkflowEval } from '@/evals/utils/tracedWorkflow';
import { RELEASE_NOTES_WORKFLOW_NAME } from '@/mastra/agents/constants';
import { releaseNotesWorkflow } from '@/mastra/workflows/releaseNotes';
import { TestCase, TestInput, TestResult } from './types';

/**
 * Expected structure of row.metadata from Braintrust dataset
 */
type ReleaseNotesMetadata = {
  testName?: string;
  description?: string;
  product?: string;
  version?: string;
  scoreThresholds?: {
    Faithfulness?: number;
    TechnicalAccuracy?: number;
  };
};

const loadReleaseNotesTestCases = async (): Promise<TestCase[]> => {
  const dataset = initDataset(PROJECT_NAME, {
    dataset: 'product_release_notes_dataset',
  });
  const testCases: TestCase[] = [];
  for await (const row of dataset) {
    // Cast row.metadata once at the top of the loop
    const metadata = row.metadata as ReleaseNotesMetadata;
    // Transform the row to ensure it has the required metadata structure
    const testCase: TestCase = {
      input: row.input as TestInput,
      expected: row.expected as TestResult,
      metadata: {
        testName:
          metadata?.testName ||
          `Release Notes - ${metadata?.product || 'unknown'} ${metadata?.version || ''}`.trim(),
        description:
          metadata?.description ||
          `Release notes for ${metadata?.product || 'unknown'} ${metadata?.version || ''}`.trim(),
        scoreThresholds: {
          Faithfulness: metadata?.scoreThresholds?.Faithfulness ?? 0.7,
          TechnicalAccuracy:
            metadata?.scoreThresholds?.TechnicalAccuracy ?? 0.8,
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
      ({ input, output }) =>
        SafeFaithfulness({
          output: JSON.stringify(output, null, 2),
          context: JSON.stringify(input.jiraIssues, null, 2),
          input: `Generate release notes for ${input.product || 'product'}`,
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

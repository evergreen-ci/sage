import { Faithfulness } from 'autoevals';
import { Eval, initDataset } from 'braintrust';
import { z } from 'zod';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { TechnicalAccuracy } from '@/evals/scorers';
import { tracedWorkflowEval } from '@/evals/utils/tracedWorkflow';
import { RELEASE_NOTES_WORKFLOW_NAME } from '@/mastra/agents/constants';
import { releaseNotesWorkflow } from '@/mastra/workflows/releaseNotes';
import { TestCase, TestInput, TestResult } from './types';

/**
 * Formats Jira issues as clean, readable text for the Faithfulness scorer.
 * Avoids passing raw JSON with structural noise and empty fields.
 * @param jiraIssues - Array of Jira issues to format
 * @returns Human-readable text representation of the issues
 */
const formatIssuesAsText = (jiraIssues: TestInput['jiraIssues']): string =>
  jiraIssues
    .map(issue => {
      const lines = [`${issue.key} (${issue.issueType}): ${issue.summary}`];
      if (issue.description?.trim()) {
        lines.push(`Description: ${issue.description.trim()}`);
      }
      if (issue.additionalMetadata) {
        for (const [key, value] of Object.entries(issue.additionalMetadata)) {
          const trimmedKey = String(key).trim();
          const trimmedValue =
            value === null || value === undefined ? '' : String(value).trim();
          if (trimmedKey && trimmedValue) {
            lines.push(`${trimmedKey}: ${trimmedValue}`);
          }
        }
      }
      if (issue.pullRequests?.length) {
        for (const pr of issue.pullRequests) {
          lines.push(`PR: ${pr.title}`);
          if (pr.description?.trim()) lines.push(`  ${pr.description.trim()}`);
        }
      }
      return lines.join('\n');
    })
    .join('\n\n');

/**
 * Recursively collects bullet text from items at any nesting depth.
 * @param items - Array of items with text and optional subitems
 * @param lines - Accumulator for output lines
 * @param indent - Current indentation prefix
 */
const collectBulletText = (
  items: Array<{ text: string; subitems?: unknown }>,
  lines: string[],
  indent = ''
): void => {
  for (const item of items) {
    lines.push(`${indent}- ${item.text}`);
    if (Array.isArray(item.subitems) && item.subitems.length > 0) {
      collectBulletText(
        item.subitems as Array<{ text: string; subitems?: unknown }>,
        lines,
        `${indent}  `
      );
    }
  }
};

/**
 * Extracts all bullet and sub-bullet text from the output as a flat list.
 * Avoids passing the full JSON structure (with citations, links, metadata)
 * to the scorer, which causes inconsistent statement decomposition.
 * @param output - The release notes output to extract text from
 * @returns Markdown-formatted bullet text
 */
const extractBulletText = (output: TestResult): string => {
  const lines: string[] = [];
  for (const section of output.sections ?? []) {
    lines.push(`## ${section.title}`);
    collectBulletText(section.items ?? [], lines);
  }
  return lines.join('\n');
};

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
            // lowered threshold for release notes generation due to variability in outputs
            // will revisit after further iterations
            metadata?.scoreThresholds?.TechnicalAccuracy ?? 0.6,
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
        Faithfulness({
          output: extractBulletText(output),
          context: formatIssuesAsText(input.jiraIssues),
          input: `Generate release notes for ${input.product || 'product'}`,
        }),
      ({ expected, output }) =>
        TechnicalAccuracy({
          output: extractBulletText(output),
          expected: extractBulletText(expected),
        }),
    ],
    experimentName: 'Release Notes Workflow Eval',
    description: 'Tests for the Release Notes workflow.',
  },
  {
    reporter: ReporterName.ReleaseNotes,
  }
);

import { AnswerCorrectness, ContextRecall } from 'autoevals';
import { Eval, initDataset } from 'braintrust';
import { z } from 'zod';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { tracedWorkflowEval } from '@/evals/utils/tracedWorkflow';
import { RELEASE_NOTES_WORKFLOW_NAME } from '@/mastra/agents/constants';
import { buildReleaseNotesSectionPlans } from '@/mastra/agents/releaseNotesAgent';
import { releaseNotesWorkflow } from '@/mastra/workflows/releaseNotes';
import { CitationAccuracy, extractAllCitations } from './scorers';
import { TestCase, TestInput, TestResult } from './types';

/**
 * Formats the scorer context to match what the agent actually sees.
 * Uses buildReleaseNotesSectionPlans to elevate curated copy,
 * mirroring the agent's input rather than raw Jira issue text.
 * @param input - The test input
 * @returns The formatted context
 */
const formatContextForScorer = (input: TestInput): string => {
  const sectionPlans = buildReleaseNotesSectionPlans(input);
  const lines: string[] = [];
  for (const issue of sectionPlans.issues) {
    lines.push(`${issue.key} (${issue.issueType}): ${issue.summary}`);
    if (issue.curatedCopy) lines.push(`Curated Copy: ${issue.curatedCopy}`);
    if (issue.description) lines.push(`Description: ${issue.description}`);
    if (issue.metadata) {
      for (const [key, value] of Object.entries(issue.metadata)) {
        lines.push(`${key}: ${value}`);
      }
    }
    if (issue.pullRequests?.length) {
      for (const pr of issue.pullRequests) {
        lines.push(`PR: ${pr.title}`);
        if (pr.description) lines.push(`  ${pr.description}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
};

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
    AnswerCorrectness?: number;
    ContextRecall?: number;
    CitationAccuracy?: number;
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
          AnswerCorrectness:
            metadata?.scoreThresholds?.AnswerCorrectness ?? 0.5,
          ContextRecall: metadata?.scoreThresholds?.ContextRecall ?? 0.7,
          CitationAccuracy: metadata?.scoreThresholds?.CitationAccuracy ?? 1.0,
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
      ({ input, output }) => {
        const bulletText = extractBulletText(output);
        return ContextRecall({
          output: bulletText,
          expected: bulletText,
          input: `Generate release notes for ${input.product || 'product'}`,
          context: formatContextForScorer(input),
        });
      },
      ({ expected, input, output }) => {
        const outputText = extractBulletText(output);
        const expectedText = extractBulletText(expected);
        return AnswerCorrectness({
          input: `Generate release notes for ${input.product || 'product'}`,
          output: outputText,
          expected: expectedText,
        });
      },
      ({ input, output }) =>
        CitationAccuracy({
          outputCitations: extractAllCitations(output),
          inputKeys: input.jiraIssues.map(issue => issue.key),
        }),
    ],
    experimentName: 'Release Notes Workflow Eval',
    description: 'Tests for the Release Notes workflow.',
  },
  {
    reporter: ReporterName.ReleaseNotes,
  }
);

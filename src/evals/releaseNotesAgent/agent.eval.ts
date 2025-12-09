import { Factuality } from 'autoevals';
import { Eval, initDataset } from 'braintrust';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { TechnicalAccuracy } from '@/evals/scorers';
import {
  generateReleaseNotes,
  releaseNotesInputSchema,
  releaseNotesOutputSchema,
} from '@/mastra/agents/releaseNotesAgent';
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

/**
 * Recursively removes empty citations arrays and filters empty strings from citations.
 * This ensures we never return empty citations arrays to Braintrust,
 * which would fail schema validation (.nonempty() requirement).
 * @param value - The value to clean (can be any type, will recursively process objects/arrays)
 * @returns The cleaned value with empty citations arrays removed and empty strings filtered from citations
 */
const removeEmptyCitations = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(removeEmptyCitations).filter(item => item !== undefined);
  }

  const record = value as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(record)) {
    // Handle citations arrays specially
    if (key === 'citations' && Array.isArray(val)) {
      // Filter out empty strings and whitespace-only strings
      const filteredCitations = val
        .map(c => (typeof c === 'string' ? c.trim() : String(c).trim()))
        .filter(c => c.length > 0);

      // Only include citations if there's at least one non-empty citation
      if (filteredCitations.length > 0) {
        cleaned[key] = filteredCitations;
      }
      // If empty, skip it entirely (don't include the field)
      continue;
    }

    // Recursively clean nested objects/arrays
    if (val !== null && val !== undefined && typeof val === 'object') {
      const cleanedVal = removeEmptyCitations(val);
      if (cleanedVal !== undefined) {
        cleaned[key] = cleanedVal;
      }
    } else {
      cleaned[key] = val;
    }
  }

  return cleaned;
};

// Task function that returns the output directly
// Braintrust's Eval will wrap this as { output: <returned value>, ... }
const releaseNotesEvalTask = async (input: TestInput) => {
  // Parse and validate input to ensure defaults are applied
  const parsedInput = releaseNotesInputSchema.parse(input);

  const start = Date.now();
  const agentResult = await generateReleaseNotes(parsedInput);
  const duration = Date.now() - start;

  if (!agentResult.object) {
    throw new Error('Release notes agent did not return structured output');
  }

  // Final cleanup pass: remove any empty citations arrays that might have slipped through
  // This is critical because Braintrust validates structured output during streaming
  const cleanedOutput = removeEmptyCitations(agentResult.object);

  // Validate the cleaned output matches the schema
  const validation = releaseNotesOutputSchema.safeParse(cleanedOutput);
  if (!validation.success) {
    throw new Error(
      `Cleaned output failed validation: ${validation.error.message}`
    );
  }

  // Return the cleaned and validated output with duration
  return {
    ...validation.data,
    duration,
  };
};

Eval(
  PROJECT_NAME,
  {
    data: loadReleaseNotesTestCases(),
    task: releaseNotesEvalTask,
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
    experimentName: 'Release Notes Agent Eval',
    description: 'Tests for the Release Notes agent.',
  },
  {
    reporter: ReporterName.ReleaseNotes,
  }
);

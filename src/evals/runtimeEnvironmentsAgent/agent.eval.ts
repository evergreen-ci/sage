import { RequestContext } from '@mastra/core/request-context';
import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME, TestUser } from '@/evals/constants';
import { loadTestCases } from '@/evals/loadTestCases';
import { ToolUsage, ToolUsageMode } from '@/evals/scorers';
import { tracedAgentEval } from '@/evals/utils/tracedAgent';
import {
  RUNTIME_ENVIRONMENTS_AGENT_NAME,
  USER_ID,
} from '@/mastra/agents/constants';
import { TestCase, TestInput, TestResult } from './types';

/**
 * Raw row shape produced by the CSV dataset loader.
 * The loader stores input and expected as flat strings, with all other
 * CSV columns placed into a flat `metadata` record.
 */
interface RawDatasetRow {
  input: string;
  expected: string;
  metadata: Record<string, string>;
}

/**
 * Transforms flat Braintrust dataset rows (from the CSV loader) into the
 * structured TestCase format expected by the eval and reporter.
 * @returns Structured test cases parsed from flat CSV-loaded dataset rows
 */
const loadAndTransformTestCases = async (): Promise<TestCase[]> => {
  const rawCases = await loadTestCases<RawDatasetRow>(
    'runtime_environments_agent_dataset'
  );
  return rawCases.map(raw => ({
    input: { content: raw.input },
    expected: {
      text: raw.expected,
      toolsUsed: raw.metadata.expected_tools
        ? raw.metadata.expected_tools.split(',').filter(Boolean)
        : [],
    },
    metadata: {
      testName: raw.metadata.testName,
      description: raw.metadata.description,
      scoreThresholds: {
        Factuality: parseFloat(raw.metadata.factuality_threshold) || 0.6,
        ToolUsage: parseFloat(raw.metadata.tool_usage_threshold) || 1.0,
      },
    },
  }));
};

Eval(
  PROJECT_NAME,
  {
    data: loadAndTransformTestCases(),
    task: tracedAgentEval<TestInput, TestResult>({
      agentName: RUNTIME_ENVIRONMENTS_AGENT_NAME,
      transformResponse: response => {
        const toolResults = response.toolCalls;
        const toolsUsed = toolResults.map(t => t.payload.toolName);
        return {
          text: response.text,
          toolsUsed,
        };
      },
      setupRequestContext: () => {
        const requestContext = new RequestContext();
        requestContext.set(USER_ID, TestUser.Regular);
        return requestContext;
      },
    }),
    scores: [
      ({ expected, input, output }) =>
        Factuality({
          expected: expected.text,
          output: output.text,
          input: input.content,
        }),
      ({ expected, output }) =>
        ToolUsage({
          output: output.toolsUsed,
          expected: expected.toolsUsed,
          mode: ToolUsageMode.Subset,
        }),
    ],
    experimentName: 'Runtime Environments Agent Eval',
    description: 'Tests for the Runtime Environments agent.',
  },
  {
    reporter: ReporterName.RuntimeEnvironments,
  }
);

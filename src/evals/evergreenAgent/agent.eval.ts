import { RuntimeContext } from '@mastra/core/runtime-context';
import { ToolResultPart } from 'ai';
import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from 'evals/constants';
import { loadTestCases } from 'evals/loadTestCases';
import { ToolUsage, ToolUsageMode } from 'evals/scorers';
import { USER_ID, EVERGREEN_AGENT_NAME } from 'mastra/agents/constants';
import { tracedAgentEval } from '../utils/tracedAgent';
import { TestCase, TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: loadTestCases<TestCase>('evergreen_agent_dataset'),
    task: tracedAgentEval<TestInput, TestResult>({
      agentName: EVERGREEN_AGENT_NAME,
      setupRuntimeContext: input => {
        const runtimeContext = new RuntimeContext();
        runtimeContext.set(USER_ID, input.user);
        return runtimeContext;
      },
      transformResponse: response => {
        const toolResults = response.toolResults as ToolResultPart[];
        const toolsUsed = toolResults.map(t => t.toolName);
        return {
          text: response.text,
          toolsUsed,
        };
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
          mode: ToolUsageMode.ExactMatch,
        }),
    ],
    experimentName: 'Evergreen Agent Eval',
    description: 'Tests for the Evergreen agent.',
  },
  {
    reporter: ReporterName.Evergreen,
  }
);

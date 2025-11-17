import { RequestContext } from '@mastra/core/request-context';
import { ToolResultPart } from 'ai';
import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { loadTestCases } from '@/evals/loadTestCases';
import { ToolUsage, ToolUsageMode } from '@/evals/scorers';
import { tracedAgentEval } from '@/evals/utils/tracedAgent';
import { USER_ID, EVERGREEN_AGENT_NAME } from '@/mastra/agents/constants';
import { TestCase, TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: loadTestCases<TestCase>('evergreen_agent_dataset'),
    task: tracedAgentEval<TestInput, TestResult>({
      agentName: EVERGREEN_AGENT_NAME,
      setupRequestContext: input => {
        const requestContext = new RequestContext();
        requestContext.set(USER_ID, input.user);
        return requestContext;
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

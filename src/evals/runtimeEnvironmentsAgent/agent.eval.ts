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

Eval(
  PROJECT_NAME,
  {
    data: loadTestCases<TestCase>('runtime_environments_agent_dataset'),
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
          input: input.text,
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

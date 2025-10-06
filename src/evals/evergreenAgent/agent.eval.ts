import { RuntimeContext } from '@mastra/core/runtime-context';
import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { toolUsage } from '@/evals/scorers';
import { USER_ID, EVERGREEN_AGENT_NAME } from '@/mastra/agents/constants';
import { tracedAgentEval } from '../utils/tracedAgent';
import { testCases } from './testCases';
import { TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: testCases,
    task: tracedAgentEval<TestInput, TestResult>({
      agentName: EVERGREEN_AGENT_NAME,
      setupRuntimeContext: input => {
        const runtimeContext = new RuntimeContext();
        runtimeContext.set(USER_ID, input.user);
        return runtimeContext;
      },
      transformResponse: response => ({
        text: response.text,
        toolsUsed: response.toolResults.map(t => t.toolName),
      }),
    }),
    scores: [
      ({ expected, input, output }) =>
        Factuality({
          expected: expected.text,
          output: output.text,
          input: input.content,
        }),
      ({ expected, output }) =>
        toolUsage({
          output: output.toolsUsed,
          expected: expected.toolsUsed,
        }),
    ],
    experimentName: 'Evergreen Agent Eval',
    description: 'Tests for the Evergreen agent.',
  },
  {
    reporter: ReporterName.Evergreen,
  }
);

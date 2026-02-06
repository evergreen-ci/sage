import { RequestContext } from '@mastra/core/request-context';
import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { loadTestCases } from '@/evals/loadTestCases';
import { ToolUsage, TechnicalAccuracy, ToolUsageMode } from '@/evals/scorers';
import { tracedAgentEval } from '@/evals/utils/tracedAgent';
import { USER_ID, SAGE_THINKING_AGENT_NAME } from '@/mastra/agents/constants';
import { TestCase, TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: loadTestCases<TestCase>('sage_thinking_agent_dataset'),
    task: tracedAgentEval<TestInput, TestResult>({
      agentName: SAGE_THINKING_AGENT_NAME,
      setupRequestContext: input => {
        const requestContext = new RequestContext();
        requestContext.set(USER_ID, input.user);
        requestContext.set('logMetadata', {
          projectName: PROJECT_NAME,
          agentName: SAGE_THINKING_AGENT_NAME,
          userId: input.user,
          input: input.content,
        });
        requestContext.set('logURL', 'https://test.log');
        return requestContext;
      },
      transformResponse: response => {
        const toolResults = response.toolCalls;
        const toolsUsed = toolResults.map(t => t.payload.toolName);
        return {
          text: response.text,
          toolsUsed,
        };
      },
    }),
    scores: [
      ({ expected, input, metadata, output }) =>
        metadata.scoreThresholds.Factuality
          ? Factuality({
              expected: expected.text,
              output: output.text,
              input: input.content,
            })
          : null,
      ({ expected, output }) =>
        ToolUsage({
          output: output.toolsUsed,
          expected: expected.toolsUsed,
          mode: ToolUsageMode.Subset,
        }),
      ({ expected, metadata, output }) =>
        metadata.scoreThresholds.TechnicalAccuracy
          ? TechnicalAccuracy({
              output: output.text,
              expected: expected.text,
            })
          : null,
    ],
    experimentName: 'Sage Thinking Agent Eval',
    description: 'Tests for the Sage Thinking agent.',
  },
  {
    reporter: ReporterName.SageThinking,
  }
);

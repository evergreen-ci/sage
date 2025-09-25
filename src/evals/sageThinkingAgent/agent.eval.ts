import { RuntimeContext } from '@mastra/core/runtime-context';
import { ToolResultPart } from 'ai';
import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from 'evals/constants';
import { ToolUsage, TechnicalAccuracy, ToolUsageMode } from 'evals/scorers';
import { USER_ID, SAGE_THINKING_AGENT_NAME } from 'mastra/agents/constants';
import { tracedAgentEval } from '../utils/tracedAgent';
import { testCases } from './testCases';
import { TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: testCases,
    task: tracedAgentEval<TestInput, TestResult>({
      agentName: SAGE_THINKING_AGENT_NAME,
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

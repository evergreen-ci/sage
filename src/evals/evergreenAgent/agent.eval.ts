import { RuntimeContext } from '@mastra/core/runtime-context';
import { ToolResultPart } from 'ai';
import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from 'evals/constants';
import { toolUsage } from 'evals/scorers';
import { callModelWithTrace } from 'evals/tracer';
import { ModelOutput } from 'evals/types';
import { mastra } from 'mastra';
import { USER_ID, EVERGREEN_AGENT_NAME } from 'mastra/agents/constants';
import { testCases } from './testCases';
import { TestInput, TestResult } from './types';

const callEvergreenAgent = async (
  input: TestInput
): ModelOutput<TestInput, TestResult> => {
  const runtimeContext = new RuntimeContext();
  runtimeContext.set(USER_ID, input.user);
  const agent = mastra.getAgent(EVERGREEN_AGENT_NAME);
  const response = await agent.generateVNext(input.content, {
    runtimeContext,
    format: 'aisdk',
  });
  const toolResults = response.toolResults as ToolResultPart[];
  const toolsUsed = toolResults.map(t => t.toolName);
  const output = {
    text: response.text,
    toolsUsed,
  };
  return {
    ...response,
    input,
    output,
  };
};

Eval(
  PROJECT_NAME,
  {
    data: testCases,
    task: async (input: TestInput) =>
      await callModelWithTrace<TestInput, TestResult>(() =>
        callEvergreenAgent(input)
      ),
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

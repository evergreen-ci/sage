import { RuntimeContext } from '@mastra/core/runtime-context';
import { Factuality, Levenshtein } from 'autoevals';
import { Eval, traced } from 'braintrust';
import { mastra } from 'mastra';
import { USER_ID, AGENT_NAME } from 'mastra/agents/constants';
import { toolUsage } from './scorers';
import { TestCase, TestUser } from './types';

const testRegularUserCanGetTaskStatus = (): TestCase => {
  const taskId =
    'evergreen_ubuntu1604_test_service_patch_5e823e1f28baeaa22ae00823d83e03082cd148ab_5e4ff3abe3c3317e352062e4_20_02_21_15_13_48';
  return {
    input: `What is the status of this task: ${taskId}?`,
    expected: {
      text: `The status of the task "${taskId}" is "failed".`,
      toolsUsed: ['getTaskTool'],
    },
    metadata: {
      testName: 'Regular User Can Access Unrestricted Task',
      user: TestUser.Regular,
      description:
        'Tests that a user can successfully fetch a task from Evergreen.',
    },
  };
};

const testRegularUserCannotAccessRestrictedTask = (): TestCase => {
  const taskId =
    'evg_lint_generate_lint_ecbbf17f49224235d43416ea55566f3b1894bbf7_25_03_21_21_09_20';
  return {
    input: `What is the status of this task: ${taskId}?`,
    expected: {
      text: `Unable to retrieve the status of this task due to insufficient permissions.`,
      toolsUsed: ['getTaskTool'],
    },
    metadata: {
      testName: 'Regular User Cannot Access Restricted Task',
      user: TestUser.Regular,
      description: 'Tests that a regular user cannot access a restricted task.',
    },
  };
};

const testCases: TestCase[] = [
  testRegularUserCanGetTaskStatus(),
  testRegularUserCannotAccessRestrictedTask(),
];

/**
 * https://www.braintrust.dev/docs/guides/experiments/write#tracing
 * This is a wrapper function that adds tracing spans to the model call.
 * @param input - Input (originally given in test case)
 * @param user - User to run the test as (originally given in test case)
 * @returns Expected result from calling agent
 */
const callModel = async (input: string, user: TestUser) =>
  traced(async span => {
    span.setAttributes({ name: 'call-model-span' });
    span.log({ input });

    const start = Date.now();
    const runtimeContext = new RuntimeContext();
    runtimeContext.set(USER_ID, user);

    const agent = mastra.getAgent(AGENT_NAME);
    const response = await agent.generate(input, { runtimeContext });
    const end = Date.now();

    const toolCalls = response.steps.flatMap(step => step.toolCalls);
    const toolResults = response.steps.flatMap(step => step.toolResults);
    const toolNames = toolCalls.map(t => t.toolName);
    const duration = end - start;

    const result = {
      text: response.text,
      toolsUsed: toolNames,
    };

    span.log({
      output: result,
      metrics: {
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        total_tokens: response.usage.totalTokens,
        reasoning_tokens: response.usage.reasoningTokens,
        cached_input_tokens: response.usage.cachedInputTokens,
        duration,
      },
      metadata: {
        tool_results: toolResults,
      },
    });

    return { ...result, duration };
  });

Eval('dev-prod-team', {
  data: testCases,
  // @ts-expect-error: Throws an error but works
  task: async (input, { metadata }) => await callModel(input, metadata.user),
  // @ts-expect-error: Throws an error but works
  scores: [Factuality, Levenshtein, toolUsage], // https://github.com/braintrustdata/autoevals/blob/main/js/manifest.ts#L37
  experimentName: 'Evergreen Agent Eval',
  description: 'Tests for the Evergreen agent.',
  tags: ['sage', 'evergreen_agent'],
});

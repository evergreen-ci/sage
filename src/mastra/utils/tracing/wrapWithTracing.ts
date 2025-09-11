import { Agent } from '@mastra/core/agent';
import { MessageListInput } from '@mastra/core/dist/agent/message-list';
import { Tool, ToolExecutionContext } from '@mastra/core/tools';
import { wrapTraced, traced } from 'braintrust';
import { ZodType } from 'zod';
import { extractText } from './utils';

/**
 * This function wraps the generateVNext and streamVNext methods of an agent with tracing.
 * @param agent - The agent to wrap with tracing.
 * @returns The agent with the wrapped methods.
 */
export const wrapAgentWithTracing = (agent: Agent) => {
  const _originalGenerateVNext = agent.generateVNext.bind(agent);
  type GenerateVNextFn = typeof _originalGenerateVNext;
  agent.generateVNext = function (
    ...args: Parameters<GenerateVNextFn>
  ): ReturnType<GenerateVNextFn> {
    const input = args[0];
    return traced(
      async span => {
        const result = await _originalGenerateVNext(...args);
        const messageInput = args[0] as MessageListInput;
        span.log({ input: extractText(messageInput) });
        span.log({ output: result.text });
        return result;
      },
      {
        name: `${agent.name}.generateVNext`,
        event: { input },
        propagatedEvent: { metadata: { root_input: input } },
      }
    ) as ReturnType<GenerateVNextFn>;
  } as GenerateVNextFn;

  const _originalStreamVNext = agent.streamVNext.bind(agent);
  type StreamVNextFn = typeof _originalStreamVNext;
  agent.streamVNext = function (
    ...args: Parameters<StreamVNextFn>
  ): ReturnType<StreamVNextFn> {
    const input = args[0];
    return traced(
      async span => {
        const result = await _originalStreamVNext(...args);
        const messageInput = args[0] as MessageListInput;
        span.log({ input: extractText(messageInput) });
        result.text.then(text => {
          span.log({ output: text });
        });

        return result;
      },
      {
        name: `${agent.name}.streamVNext`,
        event: { input },
        propagatedEvent: { metadata: { root_input: input } },
      }
    ) as ReturnType<StreamVNextFn>;
  } as StreamVNextFn;

  return agent;
};

/**
 * This function wraps the execute method of a tool with tracing.
 * @param tool - The tool to wrap with tracing.
 * @returns The tool with the wrapped method.
 */
export const wrapToolWithTracing = <
  TSchemaIn extends ZodType,
  TSchemaOut extends ZodType,
  TContext extends ToolExecutionContext<TSchemaIn>,
>(
  tool: Tool<TSchemaIn, TSchemaOut, TContext>
) => {
  if (tool.execute) {
    tool.execute = wrapTraced(tool.execute.bind(tool), {
      name: tool.id,
      type: 'tool',
    });
  }
  return tool as Tool<TSchemaIn, TSchemaOut, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (context: ToolExecutionContext<TSchemaIn>) => Promise<TSchemaOut>;
  };
};

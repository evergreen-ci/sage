import { Agent } from '@mastra/core/agent';
import { Tool, ToolExecutionContext } from '@mastra/core/tools';
import { wrapTraced } from 'braintrust';
import { ZodType } from 'zod';

/**
 * This function wraps the generateVNext and streamVNext methods of an agent with tracing.
 * @param agent - The agent to wrap with tracing.
 * @returns The agent with the wrapped methods.
 */
export const wrapAgentWithTracing = (agent: Agent) => {
  agent.generateVNext = wrapTraced(agent.generateVNext.bind(agent), {
    name: agent.name,
  });
  agent.streamVNext = wrapTraced(agent.streamVNext.bind(agent), {
    name: agent.name,
  });
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
    });
  }
  return tool as Tool<TSchemaIn, TSchemaOut, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (context: ToolExecutionContext<TSchemaIn>) => Promise<TSchemaOut>;
  };
};

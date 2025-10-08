import { createTool, Tool } from '@mastra/core';
import { ToolExecutionContext } from '@mastra/core/tools';
import { z, ZodType } from 'zod';

const inputSchema = z.object({
  question: z.string(),
  additionalContext: z.string().optional(),
});

const outputSchema = z.string();

const constructAgentMessage = (input: z.infer<typeof inputSchema>) => `
    ORIGINAL QUESTION: ${input.question}
    ADDITIONAL CONTEXT: ${input.additionalContext}
    `;

/**
 * Creates a tool from an agent.
 * @param agentId - The id of the agent to create a tool from.
 * @param description - The description of the tool.
 * @param customOutputSchema - The output schema to use for the tool.
 * @returns A tool that can be used to execute the agent.
 */
export const createToolFromAgent = <
  TInputSchema extends ZodType = typeof inputSchema,
  TOutputSchema extends ZodType = typeof outputSchema,
>(
  agentId: string,
  description: string,
  customOutputSchema?: TOutputSchema
) =>
  createTool({
    id: agentId,
    description,
    inputSchema,
    outputSchema: customOutputSchema || outputSchema,
    execute: async ({ context, mastra, runtimeContext }) => {
      const callableAgent = mastra?.getAgent(agentId);
      if (!callableAgent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      const constructedMessage = constructAgentMessage(context);
      const result = await callableAgent.generate(constructedMessage, {
        runtimeContext,
      });
      return result.text;
    },
  }) as Tool<TInputSchema, TOutputSchema, ToolExecutionContext<TInputSchema>>;

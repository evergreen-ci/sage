import { createTool } from '@mastra/core';
import { z } from 'zod';

const inputSchema = z.object({
  question: z.string(),
  additionalContext: z.string().optional(),
});

const constructAgentMessage = (input: z.infer<typeof inputSchema>) => `
    ORIGINAL QUESTION: ${input.question}
    ADDITIONAL CONTEXT: ${input.additionalContext}
    `;

/**
 * Creates a tool from an agent.
 * @param agentId - The id of the agent to create a tool from.
 * @param description - The description of the tool.
 * @returns A tool that can be used to execute the agent.
 */
export const createToolFromAgent = (agentId: string, description: string) =>
  createTool({
    id: agentId,
    description,
    inputSchema,
    execute: async ({ context, mastra, runtimeContext }) => {
      const callableAgent = mastra?.getAgent(agentId);
      if (!callableAgent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      const constructedMessage = constructAgentMessage(context);
      const result = await callableAgent.generateVNext(constructedMessage, {
        runtimeContext,
      });
      return result;
    },
  });

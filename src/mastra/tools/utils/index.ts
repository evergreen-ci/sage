import { createTool, type ValidationError } from '@mastra/core/tools';
import { z, type ZodType } from 'zod';

const inputSchema = z.object({
  question: z.string(),
  additionalContext: z.string().optional(),
});

const outputSchema = z.string();

const constructAgentMessage = (input: z.infer<typeof inputSchema>) => `
    ORIGINAL QUESTION: ${input.question}
    ADDITIONAL CONTEXT: ${input.additionalContext}
    `;

export const createToolFromAgent = (
  agentId: string,
  description: string,
  customOutputSchema?: ZodType
) =>
  createTool({
    id: agentId,
    description,
    inputSchema,
    outputSchema: customOutputSchema ?? outputSchema,
    execute: async (inputData, context) => {
      const { requestContext } = context || {};
      const callableAgent = context?.mastra?.getAgent(agentId);
      if (!callableAgent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      const constructedMessage = constructAgentMessage(inputData);
      const result = await callableAgent.generate(constructedMessage, {
        requestContext,
      });
      return result.text;
    },
  });

/**
 * Type guard to check if a tool response is a validation error.
 * @param response - The response from a tool execution
 * @returns True if the response is a ValidationError, false otherwise
 */
export const isValidationError = (
  response: unknown | ValidationError
): response is ValidationError => {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const possibleError = response as Record<string, unknown>;

  return (
    possibleError.error === true &&
    typeof possibleError.message === 'string' &&
    possibleError.validationErrors !== undefined
  );
};

/**
 * Type guard to check if a tool response is a successful response (not a validation error).
 * @param response - The response from a tool execution
 * @returns True if the response is a successful tool response, false if it's a validation error
 */
export const isToolResponse = <T = unknown>(response: unknown): response is T =>
  !isValidationError(response);

import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import { callModelWithTrace } from '@/evals/tracer';
import { ModelOutput, MastraAgentOutput } from '@/evals/types';
import { mastra } from '@/mastra';

export interface TracedAgentOptions<TInput, TOutput> {
  /**
   * The name of the agent to retrieve from Mastra
   */
  agentName: string;

  /**
   * Optional function to customize request context
   */
  setupRequestContext?: (input: TInput) => RequestContext;

  /**
   * Function to transform the agent response
   */
  transformResponse: (response: MastraAgentOutput, input: TInput) => TOutput;

  /**
   * Optional generation options for the agent
   */
  generateOptions?: Record<string, unknown>;

  /**
   * Optional Zod schema to validate the response
   */
  responseSchema?: z.ZodType<TOutput>;
}

const createTracedAgent =
  <TInput, TOutput>(
    options: TracedAgentOptions<TInput, TOutput>
  ): ((input: TInput) => Promise<ModelOutput<TInput, TOutput>>) =>
  async (input: TInput): Promise<ModelOutput<TInput, TOutput>> => {
    // Create request context
    const requestContext = options.setupRequestContext
      ? options.setupRequestContext(input)
      : new RequestContext();

    // Get the agent
    const agent = mastra.getAgent(options.agentName);

    // Generate response with default or provided options
    const response = await agent.generate(
      typeof input === 'string'
        ? input
        : (((input as Record<string, unknown>).content ?? input) as string),
      {
        requestContext,
        ...(options.generateOptions || {}),
      }
    );

    const output = options.transformResponse(response, input);

    // Validate output if schema is provided
    if (options.responseSchema) {
      const validationResult = options.responseSchema.safeParse(output);
      if (!validationResult.success) {
        throw new Error(
          `Invalid response for input ${JSON.stringify(input)} and output ${JSON.stringify(output)}: ${validationResult.error.message}`
        );
      }
    }

    // Return full traced model output
    return {
      ...response,
      input,
      output,
    };
  };

/**
 * Wrapper to create a traced agent and immediately call it with tracing
 * @param options Configuration options for the traced agent
 * @returns A function that can be used directly in evals
 */
export const tracedAgentEval =
  <TInput, TOutput>(options: TracedAgentOptions<TInput, TOutput>) =>
  async (input: TInput) =>
    await callModelWithTrace<TInput, TOutput>(
      async () => await createTracedAgent(options)(input)
    );

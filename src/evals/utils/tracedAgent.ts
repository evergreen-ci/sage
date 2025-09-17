import { RuntimeContext } from '@mastra/core/runtime-context';
import { ToolResultPart } from 'ai';
import { z } from 'zod';
import { callModelWithTrace } from 'evals/tracer';
import { ModelOutput } from 'evals/types';
import { mastra } from 'mastra';

export interface TracedAgentOptions<Input, Output> {
  /**
   * The name of the agent to retrieve from Mastra
   */
  agentName: string;

  /**
   * Optional function to customize runtime context
   */
  setupRuntimeContext?: (input: Input) => RuntimeContext;

  /**
   * Optional function to transform the agent response
   */
  transformResponse?: (
    response: {
      text: string;
      toolResults: ToolResultPart[];
    },
    input: Input
  ) => Output;

  /**
   * Optional generation options for the agent
   */
  generateOptions?: Record<string, unknown>;

  /**
   * Optional Zod schema to validate the response
   */
  responseSchema?: z.ZodType<Output>;
}

const createTracedAgent =
  <Input, Output>(
    options: TracedAgentOptions<Input, Output>
  ): ((input: Input) => Promise<ModelOutput<Input, Output>>) =>
  async (input: Input): Promise<ModelOutput<Input, Output>> => {
    // Create runtime context
    const runtimeContext = options.setupRuntimeContext
      ? options.setupRuntimeContext(input)
      : new RuntimeContext();

    // Get the agent
    const agent = mastra.getAgent(options.agentName);

    // Generate response with default or provided options
    const response = await agent.generateVNext(
      typeof input === 'string'
        ? input
        : (((input as Record<string, unknown>).content ?? input) as string),
      {
        runtimeContext,
        format: 'aisdk',
        ...(options.generateOptions || {}),
      }
    );

    // Extract tool results
    const toolResults = response.toolResults as ToolResultPart[];
    const toolsUsed = toolResults.map(t => t.toolName);

    // Transform response
    const baseResponse = {
      text: response.text,
      toolResults,
    };

    const output = options.transformResponse
      ? options.transformResponse(baseResponse, input)
      : ({
          text: response.text,
          toolsUsed,
        } as Output);

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
  <Input, Output>(options: TracedAgentOptions<Input, Output>) =>
  async (input: Input) =>
    await callModelWithTrace<Input, Output>(
      async () => await createTracedAgent(options)(input)
    );

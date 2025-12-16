import { RuntimeContext } from '@mastra/core/runtime-context';
import z from 'zod';
import { callWorkflowWithTrace } from '@/evals/tracer';
import { WorkflowOutput } from '@/evals/types';
import { mastra } from '@/mastra';

interface TracedWorkflowOptions<Input, Output, WorkflowInput> {
  workflowName: string;
  setupRuntimeContext?: (input: Input) => RuntimeContext;
  transformResponse?: (
    response: {
      result: string;
    },
    input: Input
  ) => Output;
  /**
   * Optional function to transform the input before passing it to the workflow
   * This is useful when the input is a different shape than the workflow expects
   * @param input - The input to transform
   * @returns The transformed input
   */
  transformInput?: (input: Input) => Promise<WorkflowInput>;
  responseSchema?: z.ZodType<Output>;
}

const createTracedWorkflow =
  <Input, Output, WorkflowInput>(
    options: TracedWorkflowOptions<Input, Output, WorkflowInput>
  ) =>
  async (input: Input): Promise<WorkflowOutput<Input, Output>> => {
    const transformedInput = options.transformInput
      ? await options.transformInput(input)
      : input;
    // Create runtime context
    const runtimeContext = options.setupRuntimeContext
      ? options.setupRuntimeContext(input)
      : new RuntimeContext();

    // Get the workflow
    const workflow = mastra.getWorkflow(options.workflowName);

    // Generate response with default or provided options
    const run = await workflow.createRunAsync({});
    const response = await run.start({
      inputData: transformedInput,
      runtimeContext,
    });
    if (response.status === 'failed') {
      throw new Error(`Workflow run failed: ${response.error}`);
    }
    if (response.status === 'suspended') {
      throw new Error(`Workflow run suspended: ${response.suspended}`);
    }

    // Transform response
    const baseResponse = {
      result: response.result,
    };

    const output = options.transformResponse
      ? options.transformResponse(baseResponse, input)
      : (response.result as unknown as Output);

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
      input,
      output,
    };
  };

/**
 * Wrapper to create a traced workflow and immediately call it with tracing
 * @param options Configuration options for the traced workflow
 * @returns A function that can be used directly in evals
 */
export const tracedWorkflowEval =
  <Input, Output, WorkflowInput>(
    options: TracedWorkflowOptions<Input, Output, WorkflowInput>
  ) =>
  async (input: Input) => {
    const result = await callWorkflowWithTrace<Input, Output>(
      async () => await createTracedWorkflow(options)(input)
    );
    return result.output;
  };

import { RequestContext } from '@mastra/core/request-context';
import z from 'zod';
import { WorkflowEvalOutput } from '@/evals/types';
import { mastra } from '@/mastra';

interface TracedWorkflowOptions<Input, Output, WorkflowInput> {
  workflowName: string;
  setupRequestContext?: (input: Input) => RequestContext;
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
  <Input, Output extends object, WorkflowInput>(
    options: TracedWorkflowOptions<Input, Output, WorkflowInput>
  ) =>
  async (input: Input): Promise<WorkflowEvalOutput<Input, Output>> => {
    const transformedInput = options.transformInput
      ? await options.transformInput(input)
      : input;

    // Create request context
    const requestContext = options.setupRequestContext
      ? options.setupRequestContext(input)
      : new RequestContext();

    // Get the workflow
    const workflow = mastra.getWorkflow(options.workflowName);

    const start = Date.now();
    // Generate response with default or provided options
    const run = await workflow.createRun();
    const response = await run.start({
      inputData: transformedInput,
      requestContext,
    });
    const end = Date.now();
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
      : ({
          ...response.result,
        } as unknown as Output);

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
      ...output,
      input,
      duration: end - start,
    };
  };

/**
 * Wrapper to create a traced workflow and immediately call it with tracing
 * @param options Configuration options for the traced workflow
 * @returns A function that can be used directly in evals
 */
export const tracedWorkflowEval =
  <Input, Output extends object, WorkflowInput>(
    options: TracedWorkflowOptions<Input, Output, WorkflowInput>
  ) =>
  async (input: Input) =>
    await createTracedWorkflow(options)(input);

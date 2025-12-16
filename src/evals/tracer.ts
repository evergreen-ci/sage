import { traced } from 'braintrust';
import { ModelOutput, WorkflowOutput } from './types';

/**
 * https://www.braintrust.dev/docs/guides/experiments/write#tracing
 * This is a wrapper function that adds tracing spans to the model call.
 * @param callModel - function to call the given agent
 * @returns Expected result from calling agent
 */
export const callModelWithTrace = async <TInput, TOutput>(
  callModel: () => ModelOutput<TInput, TOutput>
) =>
  traced(async span => {
    span.setAttributes({ name: 'call-model-span' });

    const start = Date.now();
    const { input, output, toolResults, usage } = await callModel();
    const end = Date.now();
    const duration = end - start;

    span.log({
      input,
      output,
      metrics: {
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        total_tokens: usage.totalTokens,
        reasoning_tokens: usage.reasoningTokens,
        cached_input_tokens: usage.cachedInputTokens,
        duration,
      },
      metadata: {
        tool_results: toolResults,
      },
    });

    return { ...output, duration };
  });

/**
 * Helper function to add duration to the output object.
 * If output is a plain object (not an array), spread it and add duration.
 * Otherwise, log a warning and return an object with result and duration.
 * @param output - The workflow output to add duration to
 * @param duration - The duration in milliseconds
 * @returns Output object with duration added, or wrapped in result object if not a plain object
 */
function addDurationToOutput<T>(
  output: T,
  duration: number
): (T & { duration: number }) | { result: T; duration: number } {
  if (output && typeof output === 'object' && !Array.isArray(output)) {
    return { ...(output as Record<string, unknown>), duration } as T & {
      duration: number;
    };
  }
  // Log warning when falling back to non-object output
  // This helps detect unexpected output types during development
  console.warn(
    '[Workflow Tracer] Unexpected output type: workflow returned non-object output',
    {
      outputType: typeof output,
      isArray: Array.isArray(output),
      outputValue: output,
    }
  );
  return { result: output, duration };
}

/**
 * https://www.braintrust.dev/docs/guides/experiments/write#tracing
 * This is a wrapper function that adds tracing spans to the workflow call.
 * @param callWorkflow - function to call the given workflow
 * @returns Expected result from calling agent
 */
export const callWorkflowWithTrace = async <TInput, TOutput>(
  callWorkflow: () => Promise<WorkflowOutput<TInput, TOutput>>
) =>
  traced(async span => {
    span.setAttributes({ name: 'call-tool-span' });

    const start = Date.now();
    const { input, output } = await callWorkflow();
    const end = Date.now();
    const duration = end - start;

    span.log({
      input,
      output,
      metrics: {
        duration,
      },
    });

    // Workflow outputs should always be objects based on schemas
    // Add duration to the output object
    const outputWithDuration = addDurationToOutput(output, duration);

    return {
      input,
      output: outputWithDuration as TOutput & { duration: number },
    };
  });

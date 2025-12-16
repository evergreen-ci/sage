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
    // Safe to assert as Record<string, unknown> because we've verified at runtime that:
    // 1. output is truthy (not null/undefined)
    // 2. output is an object (typeof === 'object')
    // 3. output is not an array (!Array.isArray(output))
    // This runtime check ensures the spread operator is safe to use
    const outputWithDuration =
      output && typeof output === 'object' && !Array.isArray(output)
        ? { ...(output as Record<string, unknown>), duration }
        : (() => {
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
          })();

    return {
      input,
      output: outputWithDuration as TOutput & { duration: number },
    };
  });

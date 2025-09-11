import { traced } from 'braintrust';
import { ModelOutput } from './types';

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

import { traced } from 'braintrust';
import { WorkflowOutput } from './types';

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

    return { ...output, duration };
  });

import {
  WorkflowResult,
  Step,
  DefaultEngineType,
  StepResult,
  StepsRecord,
} from '@mastra/core';
import { TracingProperties } from '@mastra/core/dist/ai-tracing';
import { z } from 'zod';

/**
 * Expects a workflow result to be successful
 * @param wr - The workflow result to expect
 */
export function expectSuccess<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
>(
  wr: WorkflowResult<
    TInput,
    TOutput,
    Step<
      string,
      z.ZodTypeAny,
      z.ZodTypeAny,
      z.ZodTypeAny,
      z.ZodTypeAny,
      DefaultEngineType
    >[]
  >
): asserts wr is {
  status: 'success';
  result: z.infer<TOutput>;
  input: z.infer<TInput>;
  steps: {
    [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
      ? StepResult<unknown, unknown, unknown, unknown>
      : StepResult<
          z.infer<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
          z.infer<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
          z.infer<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
          z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
        >;
  };
} & TracingProperties {
  expect(wr.status).toBe('success');
  if (wr.status === 'success') {
    expect(wr.result).toBeDefined();
  } else {
    throw new Error('Workflow result is not successful');
  }
}

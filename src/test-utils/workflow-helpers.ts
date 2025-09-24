import {
  WorkflowResult,
  Step,
  DefaultEngineType,
  StepResult,
} from '@mastra/core';
import { z } from 'zod';

/**
 * Expects a workflow result to be successful
 * @param wr - The workflow result to expect
 */
export function expectSuccess<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
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
  result: TOutput;
  input: TInput;
  steps: {
    [x: string]:
      | StepResult<unknown, unknown, unknown, unknown>
      | StepResult<unknown, unknown, unknown, unknown>;
  };
} {
  expect(wr.status).toBe('success');
  if (wr.status === 'success') {
    expect(wr.result.length).toBeGreaterThan(0);
  } else {
    throw new Error('Workflow result is not successful');
  }
}

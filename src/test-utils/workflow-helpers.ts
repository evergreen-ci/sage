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
export function expectSuccess(
  wr: WorkflowResult<
    z.ZodString,
    Step<string, any, any, any, any, DefaultEngineType>[]
  >
): asserts wr is {
  status: 'success';
  result: string;
  steps: {
    [x: string]:
      | StepResult<unknown, unknown, unknown, unknown>
      | StepResult<any, any, any, any>;
  };
} {
  expect((wr as any).status).toBe('success');
  expect(typeof (wr as any).result).toBe('string');
  expect((wr as any).result.length).toBeGreaterThan(0);
}

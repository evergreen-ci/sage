import { WorkflowResult, Step } from '@mastra/core/workflows';

/**
 * Expects a workflow result to be successful
 * @param wr - The workflow result to expect
 */
// eslint-disable-next-line func-style
export function expectSuccess(
  wr: WorkflowResult<unknown, unknown, unknown, Step<string, any, any>[]>
): asserts wr is Extract<
  WorkflowResult<unknown, unknown, unknown, Step<string, any, any>[]>,
  { status: 'success' }
> {
  expect(wr.status).toBe('success');
  if (wr.status === 'success') {
    expect(wr.result).toBeDefined();
  } else {
    throw new Error('Workflow result is not successful');
  }
}

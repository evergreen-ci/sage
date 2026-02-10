import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { WorkflowOutputSchema, WorkflowStateSchema } from './schemas';
import { initialStep, refineStep, finalizeStep, singlePassStep } from './steps';

export const iterativeRefinementWorkflow = createWorkflow({
  id: 'iterative-refinement',
  description: `Perform a 3 step iterative refinement process: initial and final analysis with an expensive model,
    and a lightweight refinement loop going through the whole document`,
  inputSchema: z.object({}),
  outputSchema: WorkflowOutputSchema,
  stateSchema: WorkflowStateSchema,
  // Occasionally, the workflow fails at a step, so we retry it a few times
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .then(initialStep)
  .dowhile(
    refineStep,
    async ({ state }) =>
      // Access inputData from the full params object
      state.idx < (state.chunks?.length ?? 0)
  )
  .then(finalizeStep)
  .commit();

export const decideAndRunStep = createStep({
  id: 'decide-and-run',
  description: 'Choose single-pass vs iterative workflow and run it',
  inputSchema: z.object({}),
  outputSchema: WorkflowOutputSchema,
  stateSchema: WorkflowStateSchema,
  execute: async params => {
    const { state } = params;
    if (!state.chunks) {
      throw new Error('Chunks are not available');
    }
    const result =
      state.chunks.length === 1
        ? await singlePassStep.execute(params)
        : await iterativeRefinementWorkflow.execute(params);

    if (!result) {
      throw new Error('Step execution failed to return a result');
    }

    return result;
  },
});

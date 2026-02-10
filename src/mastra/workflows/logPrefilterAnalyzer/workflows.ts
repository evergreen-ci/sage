import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { WorkflowOutputSchema, PrefilterStateSchema } from './schemas';
import { initialStep, refineStep, finalizeStep, singlePassStep } from './steps';

export const prefilterIterativeRefinementWorkflow = createWorkflow({
  id: 'prefilter-iterative-refinement',
  description:
    'Iterative refinement for pre-filtered error content: initial analysis, lightweight refinement loop, then final report',
  inputSchema: z.object({}),
  outputSchema: WorkflowOutputSchema,
  stateSchema: PrefilterStateSchema,
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .then(initialStep)
  .dowhile(
    refineStep,
    async ({ state }) => state.idx < (state.chunks?.length ?? 0)
  )
  .then(finalizeStep)
  .commit();

export const decideAndRunStep = createStep({
  id: 'prefilter-decide-and-run',
  description:
    'Choose single-pass vs iterative workflow for pre-filtered content',
  inputSchema: z.object({}),
  outputSchema: WorkflowOutputSchema,
  stateSchema: PrefilterStateSchema,
  execute: async params => {
    const { mastra, state } = params;
    const logger = mastra.getLogger();
    if (!state.chunks) {
      throw new Error('Chunks are not available');
    }
    if (state.chunks.length === 1) {
      logger.debug('Running single-pass on pre-filtered content (1 chunk)');
      return singlePassStep.execute(params);
    }
    logger.debug(
      `Running iterative refinement on pre-filtered content (${state.chunks.length} chunks)`
    );
    return prefilterIterativeRefinementWorkflow.execute(params);
  },
});

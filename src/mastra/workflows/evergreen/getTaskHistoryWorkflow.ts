import { createWorkflow, createStep } from '@mastra/core';
import { z } from 'zod';
import { TaskHistoryDirection } from '@/gql/generated/types';
import { getTaskTool, getTaskHistoryTool } from '@/mastra/tools/evergreen';

const getTaskStep = createStep(getTaskTool);

const getTaskHistoryStep = createStep({
  id: 'get-task-history',
  description: 'Get task history from Evergreen using task data',
  inputSchema: getTaskStep.outputSchema,
  outputSchema: z.object({
    history: getTaskHistoryTool.outputSchema,
  }),
  execute: async ({ inputData, runtimeContext, tracingContext }) => {
    const { task } = inputData;
    if (!task) {
      throw new Error('Previous get-task step did not return a task');
    }

    const taskId = task.id;
    const { displayName } = task;
    const { buildVariant } = task;
    const { projectIdentifier } = task;

    if (!taskId || !displayName || !buildVariant || !projectIdentifier) {
      throw new Error(
        `Cannot fetch history: missing required fields (id: ${taskId}, displayName: ${displayName}, buildVariant: ${buildVariant}, projectIdentifier: ${projectIdentifier})`
      );
    }

    const cursorParams = {
      cursorId: taskId,
      direction: TaskHistoryDirection.Before,
      includeCursor: true,
    };

    const historyResult = await getTaskHistoryTool.execute({
      context: {
        options: {
          taskName: displayName,
          buildVariant: buildVariant,
          projectIdentifier: projectIdentifier,
          cursorParams,
          limit: 30,
        },
      },
      tracingContext,
      runtimeContext,
    });

    return {
      history: historyResult,
    };
  },
});

export const getTaskHistoryWorkflow = createWorkflow({
  id: 'task-with-history-workflow',
  description: 'Workflow to retrieve task history information from Evergreen',
  inputSchema: getTaskStep.inputSchema,
  outputSchema: getTaskHistoryStep.outputSchema,
})
  .then(getTaskStep)
  .then(getTaskHistoryStep)
  .commit();

export default getTaskHistoryWorkflow;

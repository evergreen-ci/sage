import { createWorkflow, createStep } from '@mastra/core';
import { z } from 'zod';
import { getTaskTool, getTaskHistoryTool } from '../../tools/evergreen';

const workflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

const workflowOutputSchema = z.object({
  task: z.any(),
  history: z.any(),
  error: z.string().optional(),
});

const getTaskStep = createStep(getTaskTool);

const getTaskHistoryStep = createStep({
  id: 'get-task-history',
  description: 'Get task history from Evergreen using task data',
  inputSchema: z.object({
    task: z.any(),
  }),
  outputSchema: z.object({
    taskData: z.any(),
    historyData: z.any(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { task } = inputData;

    if (!task) {
      throw new Error('Cannot fetch history: task data is missing');
    }

    const { buildVariant, displayName, id: taskId, projectIdentifier } = task;

    if (!taskId || !displayName || !buildVariant || !projectIdentifier) {
      throw new Error(
        `Cannot fetch history: missing required fields (id: ${taskId}, displayName: ${displayName}, buildVariant: ${buildVariant}, projectIdentifier: ${projectIdentifier})`
      );
    }

    const cursorParams = {
      cursorId: taskId,
      direction: 'BEFORE' as const,
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
      runtimeContext,
    });

    return {
      task,
      historyData: historyResult,
    };
  },
});

const formatResultsStep = createStep({
  id: 'format-results',
  description: 'Format the task and history data for output',
  inputSchema: z.object({
    taskData: z.any(),
    historyData: z.any(),
  }),
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData }) => {
    const { historyData, taskData } = inputData;

    if (taskData?.error || historyData?.error) {
      throw new Error(taskData?.error || historyData?.error);
    }

    return {
      task: taskData,
      history: historyData,
    };
  },
});

export const historyWorkflow = createWorkflow({
  id: 'task-with-history-workflow',
  description: 'Workflow to retrieve task history information from Evergreen',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(getTaskStep)
  .then(getTaskHistoryStep)
  .then(formatResultsStep)
  .commit();

export default historyWorkflow;

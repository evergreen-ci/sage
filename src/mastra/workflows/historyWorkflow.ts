import { createWorkflow, createStep } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import {
  taskHistoryToolAdapter,
  taskToolAdapter,
} from '../tools/workflowAdapters';

const workflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

const workflowOutputSchema = z.object({
  task: z.any(),
  history: z.any(),
  error: z.string().optional(),
});

const getTaskStep = createStep({
  id: 'get-task-for-history',
  description: 'Get task information from Evergreen',
  inputSchema: z.object({
    taskId: z.string(),
    execution: z.number().optional(),
  }),
  outputSchema: z.object({
    taskData: z.any(),
  }),
  execute: async ({ inputData }) => {
    if (!taskToolAdapter.execute) {
      return {
        taskData: {
          error: 'taskToolAdapter.execute is not defined',
        },
      };
    }

    const runtimeContext = new RuntimeContext();

    const result = await taskToolAdapter.execute({
      context: {
        taskId: inputData.taskId,
        execution: inputData.execution,
      },
      runtimeContext,
    });

    return {
      taskData: result,
    };
  },
});

const getTaskHistoryStep = createStep({
  id: 'get-task-history',
  description: 'Get task history from Evergreen using task data',
  inputSchema: z.object({
    taskData: z.any(),
  }),
  outputSchema: z.object({
    taskData: z.any(),
    historyData: z.any(),
  }),
  execute: async ({ inputData }) => {
    const { taskData } = inputData;

    if (taskData?.error) {
      return {
        taskData,
        historyData: {
          error: 'Cannot fetch history: task data has error',
        },
      };
    }

    const task = taskData?.task;

    if (!task) {
      return {
        taskData,
        historyData: {
          error: 'Cannot fetch history: task data is missing',
        },
      };
    }

    const taskId = task.id;
    const { displayName } = task;
    const { buildVariant } = task;
    const { projectIdentifier } = task;

    if (!taskId || !displayName || !buildVariant || !projectIdentifier) {
      return {
        taskData,
        historyData: {
          error: `Cannot fetch history: missing required fields (id: ${taskId}, displayName: ${displayName}, buildVariant: ${buildVariant}, projectIdentifier: ${projectIdentifier})`,
        },
      };
    }

    if (!taskHistoryToolAdapter.execute) {
      return {
        taskData,
        historyData: {
          error: 'taskHistoryToolAdapter.execute is not defined',
        },
      };
    }

    const runtimeContext = new RuntimeContext();

    const cursorParams = {
      cursorId: taskId,
      direction: 'BEFORE' as const,
      includeCursor: true,
    };

    const historyResult = await taskHistoryToolAdapter.execute({
      context: {
        taskName: displayName,
        buildVariant: buildVariant,
        projectIdentifier: projectIdentifier,
        cursorParams,
        limit: 30,
      },
      runtimeContext,
    });

    return {
      taskData,
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
      return {
        task: taskData?.error ? null : taskData,
        history: historyData?.error ? null : historyData,
        error: taskData?.error || historyData?.error,
      };
    }

    return {
      task: taskData,
      history: historyData,
      error: undefined,
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

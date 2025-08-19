import { createWorkflow, createStep } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { USER_ID } from '../agents/constants';
import { taskFilesToolAdapter } from '../tools/workflowAdapters';
import { getRequestContext } from '../utils/requestContext';

const workflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

const workflowOutputSchema = z.object({
  taskFiles: z.any(),
  error: z.string().optional(),
});

const getTaskFilesStep = createStep({
  id: 'get-task-files',
  description: 'Get task files from Evergreen',
  inputSchema: z.object({
    taskId: z.string(),
    execution: z.number().optional(),
  }),
  outputSchema: z.object({
    data: z.any(),
  }),
  execute: async ({ inputData }) => {
    if (!taskFilesToolAdapter.execute) {
      return {
        data: {
          error: 'taskFilesToolAdapter.execute is not defined',
        },
      };
    }
    const runtimeContext = new RuntimeContext();

    const requestContext = getRequestContext();
    if (requestContext?.userId) {
      runtimeContext.set(USER_ID, requestContext.userId);
    }

    const result = await taskFilesToolAdapter.execute({
      context: {
        taskId: inputData.taskId,
        execution: inputData.execution,
      },
      runtimeContext,
    });

    return {
      data: result,
    };
  },
});

const formatTaskFilesStep = createStep({
  id: 'format-task-files',
  description: 'Format the task files data for output',
  inputSchema: z.object({
    data: z.any(),
  }),
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData }) => {
    const { data } = inputData;

    if (data?.error) {
      return {
        taskFiles: null,
        error: data.error,
      };
    }
    return {
      taskFiles: data,
      error: undefined,
    };
  },
});

export const taskFilesWorkflow = createWorkflow({
  id: 'task-files-workflow',
  description:
    'Workflow to retrieve and process Evergreen task files information',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(getTaskFilesStep)
  .then(formatTaskFilesStep)
  .commit();

export default taskFilesWorkflow;

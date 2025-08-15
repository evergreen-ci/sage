import { createWorkflow, createStep } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { taskToolAdapter } from '../tools/workflowAdapters';

const workflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

const workflowOutputSchema = z.object({
  task: z.any(),
  error: z.string().optional(),
});

const getTaskStep = createStep({
  id: 'get-task',
  description: 'Get task information from Evergreen',
  inputSchema: z.object({
    taskId: z.string(),
    execution: z.number().optional(),
  }),
  outputSchema: z.object({
    data: z.any(),
  }),
  execute: async ({ inputData }) => {
    if (!taskToolAdapter.execute) {
      return {
        data: {
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
      data: result,
    };
  },
});

const formatTaskStep = createStep({
  id: 'format-task',
  description: 'Format the task data for output',
  inputSchema: z.object({
    data: z.any(),
  }),
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData }) => {
    const { data } = inputData;

    if (data?.error) {
      return {
        task: null,
        error: data.error,
      };
    }
    return {
      task: data,
      error: undefined,
    };
  },
});

export const taskWorkflow = createWorkflow({
  id: 'task-workflow',
  description: 'Workflow to retrieve and process Evergreen task information',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(getTaskStep)
  .then(formatTaskStep)
  .commit();

export default taskWorkflow;

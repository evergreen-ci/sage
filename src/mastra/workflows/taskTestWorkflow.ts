import { createWorkflow, createStep } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { taskTestsToolAdapter } from '../tools/workflowAdapters';

const workflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

const workflowOutputSchema = z.object({
  taskTests: z.any(),
  error: z.string().optional(),
});

const getTaskTestsStep = createStep({
  id: 'get-task-tests',
  description: 'Get task information from Evergreen',
  inputSchema: z.object({
    taskId: z.string(),
    execution: z.number().optional(),
  }),
  outputSchema: z.object({
    data: z.any(),
  }),
  execute: async ({ inputData }) => {
    if (!taskTestsToolAdapter.execute) {
      return {
        data: {
          error: 'taskTestsToolAdapter.execute is not defined',
        },
      };
    }
    const runtimeContext = new RuntimeContext();

    const result = await taskTestsToolAdapter.execute({
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

const formatTaskTestsStep = createStep({
  id: 'format-task-tests',
  description: 'Format the task tests data for output',
  inputSchema: z.object({
    data: z.any(),
  }),
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData }) => {
    const { data } = inputData;

    if (data?.error) {
      return {
        taskTests: null,
        error: data.error,
      };
    }
    return {
      taskTests: data,
      error: undefined,
    };
  },
});

export const taskTestWorkflow = createWorkflow({
  id: 'task-tests-workflow',
  description:
    'Workflow to retrieve and process Evergreen task tests information',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(getTaskTestsStep)
  .then(formatTaskTestsStep)
  .commit();

export default taskTestWorkflow;

import { createWorkflow, createStep } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import taskToolAdapter from '../tools/workflow/taskToolAdapter';

// Define the workflow input schema
const workflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

// Define the workflow output schema
const workflowOutputSchema = z.object({
  task: z.any(),
  error: z.string().optional(),
});

// Create a step that retrieves task information
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
    // Check if the tool has an execute function
    if (!taskToolAdapter.execute) {
      return {
        data: {
          error: 'taskToolAdapter.execute is not defined',
        },
      };
    }

    // Create a new RuntimeContext
    const runtimeContext = new RuntimeContext();

    // Execute the taskToolAdapter with the provided context
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

// Create a step to process and format the task data
const formatTaskStep = createStep({
  id: 'format-task',
  description: 'Format the task data for output',
  inputSchema: z.object({
    data: z.any(),
  }),
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData }) => {
    const { data } = inputData;

    // Check if there's an error in the data
    if (data?.error) {
      return {
        task: null,
        error: data.error,
      };
    }

    // Return formatted task data
    return {
      task: data,
      error: undefined,
    };
  },
});

// Create the workflow
export const taskWorkflow = createWorkflow({
  id: 'task-workflow',
  description: 'Workflow to retrieve and process Evergreen task information',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // First step: get the task
  .then(getTaskStep)
  // Second step: format the result
  .then(formatTaskStep)
  // Commit the workflow
  .commit();

export default taskWorkflow;

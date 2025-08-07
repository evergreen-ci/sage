import { createWorkflow, createStep } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import taskHistoryToolAdapter from '../tools/workflow/taskHistoryToolAdapter';
import taskToolAdapter from '../tools/workflow/taskToolAdapter';

// Define the workflow input schema
const workflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
  projectIdentifier: z.string(),
  buildVariant: z.string(),
  taskName: z.string(),
  limit: z.number().optional(),
});

// Define the workflow output schema
const workflowOutputSchema = z.object({
  task: z.any(),
  history: z.any(),
  error: z.string().optional(),
});

// Create a step that retrieves task information
const getTaskStep = createStep({
  id: 'get-task-with-history',
  description: 'Get task information from Evergreen',
  inputSchema: z.object({
    taskId: z.string(),
    execution: z.number().optional(),
    projectIdentifier: z.string(),
    buildVariant: z.string(),
    taskName: z.string(),
    limit: z.number().optional(),
  }),
  outputSchema: z.object({
    taskData: z.any(),
    taskId: z.string(),
    projectIdentifier: z.string(),
    buildVariant: z.string(),
    taskName: z.string(),
    limit: z.number().optional(),
  }),
  execute: async ({ inputData }) => {
    // Check if the tool has an execute function
    if (!taskToolAdapter.execute) {
      return {
        taskData: {
          error: 'taskToolAdapter.execute is not defined',
        },
        taskId: inputData.taskId,
        projectIdentifier: inputData.projectIdentifier,
        buildVariant: inputData.buildVariant,
        taskName: inputData.taskName,
        limit: inputData.limit,
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
      taskData: result,
      taskId: inputData.taskId,
      projectIdentifier: inputData.projectIdentifier,
      buildVariant: inputData.buildVariant,
      taskName: inputData.taskName,
      limit: inputData.limit,
    };
  },
});

// Create a step that retrieves task history
const getTaskHistoryStep = createStep({
  id: 'get-task-history',
  description: 'Get task history from Evergreen',
  inputSchema: z.object({
    taskData: z.any(),
    taskId: z.string(),
    projectIdentifier: z.string(),
    buildVariant: z.string(),
    taskName: z.string(),
    limit: z.number().optional(),
  }),
  outputSchema: z.object({
    taskData: z.any(),
    historyData: z.any(),
  }),
  execute: async ({ inputData }) => {
    // Check if the tool has an execute function
    if (!taskHistoryToolAdapter.execute) {
      return {
        taskData: inputData.taskData,
        historyData: {
          error: 'taskHistoryToolAdapter.execute is not defined',
        },
      };
    }

    // Create a new RuntimeContext
    const runtimeContext = new RuntimeContext();

    // Create cursor params for the history query
    const cursorParams = {
      cursorId: inputData.taskId,
      direction: 'BEFORE' as const,
      includeCursor: false,
    };

    // Execute the taskHistoryToolAdapter with the provided context
    const historyResult = await taskHistoryToolAdapter.execute({
      context: {
        projectIdentifier: inputData.projectIdentifier,
        buildVariant: inputData.buildVariant,
        taskName: inputData.taskName,
        cursorParams,
        limit: inputData.limit,
      },
      runtimeContext,
    });

    return {
      taskData: inputData.taskData,
      historyData: historyResult,
    };
  },
});

// Create a step to format the combined results
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

    // Check if there's an error in either dataset
    if (taskData?.error || historyData?.error) {
      return {
        task: taskData?.error ? null : taskData,
        history: historyData?.error ? null : historyData,
        error: taskData?.error || historyData?.error,
      };
    }

    // Return formatted data
    return {
      task: taskData,
      history: historyData,
      error: undefined,
    };
  },
});

// Create the workflow
export const taskWithHistoryWorkflow = createWorkflow({
  id: 'task-with-history-workflow',
  description:
    'Workflow to retrieve task information and its history from Evergreen',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // First step: get the task with all input data
  .then(getTaskStep)
  // Second step: get the task history (data is already passed through from previous step)
  .then(getTaskHistoryStep)
  // Third step: format the results
  .then(formatResultsStep)
  // Commit the workflow
  .commit();

export default taskWithHistoryWorkflow;

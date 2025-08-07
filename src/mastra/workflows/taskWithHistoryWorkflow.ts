import { createWorkflow, createStep } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import taskHistoryToolAdapter from '../tools/workflow/taskHistoryToolAdapter';
import taskToolAdapter from '../tools/workflow/taskToolAdapter';

// Define the workflow input schema - only needs taskId and optional execution
const workflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

// Define the workflow output schema
const workflowOutputSchema = z.object({
  task: z.any(),
  history: z.any(),
  error: z.string().optional(),
});

// Create a step that retrieves task information
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
    // Check if the tool has an execute function
    if (!taskToolAdapter.execute) {
      return {
        taskData: {
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
      taskData: result,
    };
  },
});

// Create a step that retrieves task history using data from the task
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
    
    // Check if there's an error in task data
    if (taskData?.error) {
      return {
        taskData,
        historyData: {
          error: 'Cannot fetch history: task data has error',
        },
      };
    }
    
    // Extract the task object from the response
    const task = taskData?.task;
    
    if (!task) {
      return {
        taskData,
        historyData: {
          error: 'Cannot fetch history: task data is missing',
        },
      };
    }
    
    // Extract required fields from the task response
    const taskId = task.id;
    const displayName = task.displayName;
    const buildVariant = task.buildVariant;
    const projectIdentifier = task.projectIdentifier;
    
    // Validate required fields
    if (!taskId || !displayName || !buildVariant || !projectIdentifier) {
      return {
        taskData,
        historyData: {
          error: `Cannot fetch history: missing required fields (id: ${taskId}, displayName: ${displayName}, buildVariant: ${buildVariant}, projectIdentifier: ${projectIdentifier})`,
        },
      };
    }
    
    // Check if the tool has an execute function
    if (!taskHistoryToolAdapter.execute) {
      return {
        taskData,
        historyData: {
          error: 'taskHistoryToolAdapter.execute is not defined',
        },
      };
    }

    // Create a new RuntimeContext
    const runtimeContext = new RuntimeContext();

    // Create cursor params using the task id
    const cursorParams = {
      cursorId: taskId,
      direction: 'BEFORE' as const,
      includeCursor: true, // Changed to true as per the example
    };

    // Execute the taskHistoryToolAdapter with data from the task
    const historyResult = await taskHistoryToolAdapter.execute({
      context: {
        taskName: displayName, // Use displayName as taskName
        buildVariant: buildVariant,
        projectIdentifier: projectIdentifier,
        cursorParams,
        limit: 10, // Default limit
      },
      runtimeContext,
    });

    return {
      taskData,
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
    const { taskData, historyData } = inputData;

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
  description: 'Workflow to retrieve task information and its history from Evergreen',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // First step: get the task
  .then(getTaskStep)
  // Second step: get the task history using task data
  .then(getTaskHistoryStep)
  // Third step: format the results
  .then(formatResultsStep)
  // Commit the workflow
  .commit();

export default taskWithHistoryWorkflow;
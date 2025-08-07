import { createWorkflow, createStep } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import taskToolAdapter from '../tools/workflow/taskToolAdapter';
import versionToolAdapter from '../tools/workflow/versionToolAdapter';

// Define the workflow input schema - only needs taskId and optional execution
const workflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
  includeNeverActivatedTasks: z.boolean().optional(),
});

// Define the workflow output schema
const workflowOutputSchema = z.object({
  task: z.any(),
  version: z.any(),
  error: z.string().optional(),
});

// Create a step that retrieves task information
const getTaskStep = createStep({
  id: 'get-task-for-version',
  description: 'Get task information from Evergreen',
  inputSchema: z.object({
    taskId: z.string(),
    execution: z.number().optional(),
    includeNeverActivatedTasks: z.boolean().optional(),
  }),
  outputSchema: z.object({
    taskData: z.any(),
    includeNeverActivatedTasks: z.boolean().optional(),
  }),
  execute: async ({ inputData }) => {
    // Check if the tool has an execute function
    if (!taskToolAdapter.execute) {
      return {
        taskData: {
          error: 'taskToolAdapter.execute is not defined',
        },
        includeNeverActivatedTasks: inputData.includeNeverActivatedTasks,
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
      includeNeverActivatedTasks: inputData.includeNeverActivatedTasks,
    };
  },
});

// Create a step that retrieves version information using data from the task
const getVersionStep = createStep({
  id: 'get-version',
  description: 'Get version information from Evergreen using task data',
  inputSchema: z.object({
    taskData: z.any(),
    includeNeverActivatedTasks: z.boolean().optional(),
  }),
  outputSchema: z.object({
    taskData: z.any(),
    versionData: z.any(),
  }),
  execute: async ({ inputData }) => {
    const { taskData, includeNeverActivatedTasks } = inputData;
    
    // Check if there's an error in task data
    if (taskData?.error) {
      return {
        taskData,
        versionData: {
          error: 'Cannot fetch version: task data has error',
        },
      };
    }
    
    // Extract the task object from the response
    const task = taskData?.task;
    
    if (!task) {
      return {
        taskData,
        versionData: {
          error: 'Cannot fetch version: task data is missing',
        },
      };
    }
    
    // Extract the versionMetadata.id from the task response
    const versionId = task.versionMetadata?.id;
    
    if (!versionId) {
      return {
        taskData,
        versionData: {
          error: 'Cannot fetch version: versionMetadata.id is missing from task',
        },
      };
    }
    
    // Check if the tool has an execute function
    if (!versionToolAdapter.execute) {
      return {
        taskData,
        versionData: {
          error: 'versionToolAdapter.execute is not defined',
        },
      };
    }

    // Create a new RuntimeContext
    const runtimeContext = new RuntimeContext();

    // Execute the versionToolAdapter with the version ID
    const versionResult = await versionToolAdapter.execute({
      context: {
        id: versionId,
        includeNeverActivatedTasks: includeNeverActivatedTasks,
      },
      runtimeContext,
    });

    return {
      taskData,
      versionData: versionResult,
    };
  },
});

// Create a step to format the combined results
const formatResultsStep = createStep({
  id: 'format-results',
  description: 'Format the task and version data for output',
  inputSchema: z.object({
    taskData: z.any(),
    versionData: z.any(),
  }),
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData }) => {
    const { taskData, versionData } = inputData;

    // Check if there's an error in either dataset
    if (taskData?.error || versionData?.error) {
      return {
        task: taskData?.error ? null : taskData,
        version: versionData?.error ? null : versionData,
        error: taskData?.error || versionData?.error,
      };
    }

    // Return formatted data
    return {
      task: taskData,
      version: versionData,
      error: undefined,
    };
  },
});

// Create the workflow
export const versionWorkflow = createWorkflow({
  id: 'version-workflow',
  description: 'Workflow to retrieve task information and its version from Evergreen',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // First step: get the task
  .then(getTaskStep)
  // Second step: get the version using task data
  .then(getVersionStep)
  // Third step: format the results
  .then(formatResultsStep)
  // Commit the workflow
  .commit();

export default versionWorkflow;
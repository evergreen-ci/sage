import { createWorkflow, createStep } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { taskToolAdapter, versionToolAdapter } from '../tools/workflowAdapters';

const workflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
  includeNeverActivatedTasks: z.boolean().optional(),
});

const workflowOutputSchema = z.object({
  task: z.any(),
  version: z.any(),
  error: z.string().optional(),
});

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
    if (!taskToolAdapter.execute) {
      return {
        taskData: {
          error: 'taskToolAdapter.execute is not defined',
        },
        includeNeverActivatedTasks: inputData.includeNeverActivatedTasks,
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
      includeNeverActivatedTasks: inputData.includeNeverActivatedTasks,
    };
  },
});

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
    const { includeNeverActivatedTasks, taskData } = inputData;

    if (taskData?.error) {
      return {
        taskData,
        versionData: {
          error: 'Cannot fetch version: task data has error',
        },
      };
    }

    const task = taskData?.task;

    if (!task) {
      return {
        taskData,
        versionData: {
          error: 'Cannot fetch version: task data is missing',
        },
      };
    }

    const versionId = task.versionMetadata?.id;

    if (!versionId) {
      return {
        taskData,
        versionData: {
          error:
            'Cannot fetch version: versionMetadata.id is missing from task',
        },
      };
    }

    if (!versionToolAdapter.execute) {
      return {
        taskData,
        versionData: {
          error: 'versionToolAdapter.execute is not defined',
        },
      };
    }

    const runtimeContext = new RuntimeContext();

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

    if (taskData?.error || versionData?.error) {
      return {
        task: taskData?.error ? null : taskData,
        version: versionData?.error ? null : versionData,
        error: taskData?.error || versionData?.error,
      };
    }

    return {
      task: taskData,
      version: versionData,
      error: undefined,
    };
  },
});

export const versionWorkflow = createWorkflow({
  id: 'version-workflow',
  description: 'Workflow to retrieve task version information from Evergreen',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(getTaskStep)
  .then(getVersionStep)
  .then(formatResultsStep)
  .commit();

export default versionWorkflow;

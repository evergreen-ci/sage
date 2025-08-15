import { createWorkflow, createStep } from '@mastra/core';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import {
  taskHistoryToolAdapter,
  taskToolAdapter,
  taskFilesToolAdapter,
  taskTestsToolAdapter,
  versionToolAdapter,
} from '../tools/workflowAdapters';

const taskWorkflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

const taskWorkflowOutputSchema = z.object({
  task: z.any(),
  error: z.string().optional(),
});

const historyWorkflowOutputSchema = z.object({
  task: z.any(),
  history: z.any(),
  error: z.string().optional(),
});

const versionWorkflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
  includeNeverActivatedTasks: z.boolean().optional(),
});

const versionWorkflowOutputSchema = z.object({
  task: z.any(),
  version: z.any(),
  error: z.string().optional(),
});

const taskFilesWorkflowOutputSchema = z.object({
  taskFiles: z.any(),
  error: z.string().optional(),
});

const taskTestsWorkflowInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
  statusList: z.array(z.enum(['fail', 'pass'])).optional(),
  testName: z.string().optional(),
});

const taskTestsWorkflowOutputSchema = z.object({
  taskTests: z.any(),
  error: z.string().optional(),
});

const taskDataSchema = z.object({
  task: z
    .object({
      id: z.string(),
      displayName: z.string(),
      buildVariant: z.string(),
      projectIdentifier: z.string(),
    })
    .passthrough()
    .optional(),
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
  outputSchema: taskWorkflowOutputSchema,
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
  inputSchema: taskWorkflowInputSchema,
  outputSchema: taskWorkflowOutputSchema,
})
  .then(getTaskStep)
  .then(formatTaskStep)
  .commit();

const getTaskForHistoryStep = createStep({
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

    const validationResult = taskDataSchema.safeParse(taskData);

    if (!validationResult.success) {
      return {
        taskData,
        historyData: {
          error: `Cannot fetch history: ${validationResult.error.errors.map(e => e.message).join(', ')}`,
        },
      };
    }

    const { task } = validationResult.data;

    if (!task) {
      return {
        taskData,
        historyData: {
          error: 'Cannot fetch history: task data is missing',
        },
      };
    }

    // These fields are guaranteed to exist after Zod validation
    const taskId = task.id;
    const { displayName } = task;
    const { buildVariant } = task;
    const { projectIdentifier } = task;

    if (!taskHistoryToolAdapter.execute) {
      return {
        taskData,
        historyData: {
          error: 'taskHistoryToolAdapter.execute is not defined',
        },
      };
    }

    const runtimeContext = new RuntimeContext();

    const historyResult = await taskHistoryToolAdapter.execute({
      context: {
        taskName: displayName,
        buildVariant: buildVariant,
        projectIdentifier: projectIdentifier,
        limit: 50,
      },
      runtimeContext,
    });

    return {
      taskData,
      historyData: historyResult,
    };
  },
});

const formatHistoryResultsStep = createStep({
  id: 'format-results',
  description: 'Format the task and history data for output',
  inputSchema: z.object({
    taskData: z.any(),
    historyData: z.any(),
  }),
  outputSchema: historyWorkflowOutputSchema,
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
  inputSchema: taskWorkflowInputSchema,
  outputSchema: historyWorkflowOutputSchema,
})
  .then(getTaskForHistoryStep)
  .then(getTaskHistoryStep)
  .then(formatHistoryResultsStep)
  .commit();

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
  outputSchema: taskFilesWorkflowOutputSchema,
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
  inputSchema: taskWorkflowInputSchema,
  outputSchema: taskFilesWorkflowOutputSchema,
})
  .then(getTaskFilesStep)
  .then(formatTaskFilesStep)
  .commit();

const getTaskTestsStep = createStep({
  id: 'get-task-tests',
  description: 'Get tests information from Evergreen for a task',
  inputSchema: taskTestsWorkflowInputSchema,
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
        id: inputData.taskId,
        execution: inputData.execution,
        statusList: inputData.statusList || ['fail', 'pass'],
        testName: inputData.testName || '',
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
  outputSchema: taskTestsWorkflowOutputSchema,
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
    'Workflow to retrieve and process Evergreen tests information for a task',
  inputSchema: taskWorkflowInputSchema,
  outputSchema: taskTestsWorkflowOutputSchema,
})
  .then(getTaskTestsStep)
  .then(formatTaskTestsStep)
  .commit();

const getTaskForVersionStep = createStep({
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

const formatVersionResultsStep = createStep({
  id: 'format-results',
  description: 'Format the task and version data for output',
  inputSchema: z.object({
    taskData: z.any(),
    versionData: z.any(),
  }),
  outputSchema: versionWorkflowOutputSchema,
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
  inputSchema: versionWorkflowInputSchema,
  outputSchema: versionWorkflowOutputSchema,
})
  .then(getTaskForVersionStep)
  .then(getVersionStep)
  .then(formatVersionResultsStep)
  .commit();

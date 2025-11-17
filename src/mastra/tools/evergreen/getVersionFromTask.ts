import { createTool } from '@mastra/core';
import { z } from 'zod';
import getTaskTool from './getTask';
import getVersionTool from './getVersion';

const getVersionFromTaskInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

const getVersionFromTaskOutputSchema = getVersionTool.outputSchema;

const getVersionFromTaskTool = createTool({
  id: 'getVersionFromTask',
  description:
    'Get version information from Evergreen using a task ID. This tool fetches the task details first, then retrieves the associated version information. It requires a taskId and optionally an execution number.',
  inputSchema: getVersionFromTaskInputSchema,
  outputSchema: getVersionFromTaskOutputSchema,
  execute: async ({ context, runtimeContext, tracingContext }) => {
    const { execution, taskId } = context;

    // Step 1: Fetch task data
    const taskResult = await getTaskTool.execute({
      context: { taskId, execution },
      runtimeContext,
      tracingContext,
    });

    const { task } = taskResult;

    if (!task) {
      throw new Error('Cannot fetch version: task data is missing');
    }

    // Step 2: Extract and validate version ID
    const versionId = task.versionMetadata?.id;

    if (!versionId) {
      throw new Error(
        'Cannot fetch version: versionMetadata.id is missing from task'
      );
    }

    // Step 3: Fetch version data
    const versionResult = await getVersionTool.execute({
      context: {
        id: versionId,
      },
      tracingContext,
      runtimeContext,
    });

    return versionResult;
  },
});

export default getVersionFromTaskTool;

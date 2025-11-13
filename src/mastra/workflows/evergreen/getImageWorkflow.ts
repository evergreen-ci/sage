import { createWorkflow, createStep } from '@mastra/core';
import { z } from 'zod';
import {
  getTaskTool,
  getDistroTool,
  getImageTool,
} from '@/mastra/tools/evergreen';

const routeToDistro = createStep({
  id: 'routeToDistro',
  description:
    'Route to get distro - either from taskId or use provided distroId',
  inputSchema: z.object({
    taskId: z.string().optional(),
    execution: z.number().optional(),
    distroId: z.string().optional(),
  }),
  outputSchema: z.object({
    distroId: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { distroId, execution, taskId } = inputData;

    if (!taskId && !distroId) {
      throw new Error('Either taskId or distroId must be provided');
    }

    // If distroId is provided, use it directly
    if (distroId) {
      return {
        distroId,
      };
    }

    // If taskId is provided, get the task and extract distroId
    if (taskId) {
      const taskResult = await getTaskTool.execute({
        context: { taskId, execution },
        runtimeContext: {} as any,
        tracingContext: {} as any,
      });

      const { task } = taskResult;

      if (!task) {
        throw new Error('Cannot extract distroId: task data is missing');
      }

      // Type assertion needed because GraphQL types may not include distroId in the query result type
      const taskWithDistroId = task as typeof task & { distroId?: string };

      if (!taskWithDistroId.distroId) {
        throw new Error('Cannot extract distroId: task.distroId is missing');
      }

      return {
        distroId: taskWithDistroId.distroId,
      };
    }

    throw new Error('Unexpected: neither taskId nor distroId provided');
  },
});

const getDistro = createStep({
  ...getDistroTool,
  inputSchema: z.object({
    distroId: z.string(),
  }),
});

const extractImageId = createStep({
  id: 'extractImageId',
  description: 'Extract imageId from distro data',
  inputSchema: getDistroTool.outputSchema,
  outputSchema: z.object({
    imageId: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { distro } = inputData;

    if (!distro) {
      throw new Error('Cannot extract imageId: distro data is missing');
    }

    if (!distro.imageId) {
      throw new Error('Cannot extract imageId: distro.imageId is missing');
    }

    return {
      imageId: distro.imageId,
    };
  },
});

const getImage = createStep({
  ...getImageTool,
  inputSchema: z.object({
    imageId: z.string(),
  }),
});

const workflowInputSchema = z.object({
  taskId: z.string().optional(),
  execution: z.number().optional(),
  distroId: z.string().optional(),
});

const getImageWorkflow = createWorkflow({
  id: 'getImage',
  description:
    'Unified workflow to retrieve image/AMI information from Evergreen. Can start from either a taskId or distroId. Gets the distro to find the associated imageId, then retrieves full image information including packages, toolchains, changes, and operating system details.',
  inputSchema: workflowInputSchema,
  outputSchema: getImageTool.outputSchema,
})
  .then(routeToDistro)
  .then(getDistro)
  .then(extractImageId)
  .then(getImage)
  .commit();

export default getImageWorkflow;

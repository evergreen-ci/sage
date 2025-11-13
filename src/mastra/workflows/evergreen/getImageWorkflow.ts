import { createWorkflow, createStep } from '@mastra/core';
import { z } from 'zod';
import {
  getTaskTool,
  getDistroTool,
  getImageTool,
} from '@/mastra/tools/evergreen';

const workflowInputSchema = z.object({
  taskId: z.string().optional(),
  execution: z.number().optional(),
  distroId: z.string().optional(),
});

const getDistroId = createStep({
  id: 'get-distro-id',
  description: 'Get distro either from taskId or use provided distroId',
  inputSchema: workflowInputSchema,
  outputSchema: getDistroTool.inputSchema,
  execute: async ({ inputData, runtimeContext, tracingContext }) => {
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
        context: { taskId: taskId, execution: execution },
        runtimeContext: runtimeContext,
        tracingContext: tracingContext,
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

// kim: TODO: figure out if this still works, Parsley AI now errors because it doesn't get any distro data for some reason.
const getDistro = createStep(getDistroTool);

const extractImageId = createStep({
  id: 'extract-image-id',
  description: 'Extract imageId from distro data',
  inputSchema: getDistro.outputSchema,
  outputSchema: getImageTool.inputSchema,
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

const getImage = createStep(getImageTool);

const getImageWorkflow = createWorkflow({
  id: 'get-image-workflow',
  description:
    'Unified workflow to retrieve image/AMI information from Evergreen. Can start from either a taskId or distroId. Gets the distro to find the associated imageId, then retrieves full image information including packages, toolchains, changes, and operating system details.',
  inputSchema: workflowInputSchema,
  outputSchema: getImageTool.outputSchema,
})
  .then(getDistroId)
  .then(getDistro)
  .then(extractImageId)
  .then(getImage)
  .commit();

export default getImageWorkflow;

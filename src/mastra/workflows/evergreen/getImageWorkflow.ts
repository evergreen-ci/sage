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
    changesOnly: z.boolean().optional().default(false),
  }),
  outputSchema: z.object({
    distroId: z.string(),
    changesOnly: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { changesOnly = false, distroId, execution, taskId } = inputData;

    if (!taskId && !distroId) {
      throw new Error('Either taskId or distroId must be provided');
    }

    // If distroId is provided, use it directly
    if (distroId) {
      return {
        distroId,
        changesOnly,
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
        changesOnly,
      };
    }

    throw new Error('Unexpected: neither taskId nor distroId provided');
  },
});

const getDistroWithChangesOnly = createStep({
  id: 'getDistroWithChangesOnly',
  description: 'Get distro and pass through changesOnly flag',
  inputSchema: z.object({
    distroId: z.string(),
    changesOnly: z.boolean(),
  }),
  outputSchema: z.intersection(
    getDistroTool.outputSchema,
    z.object({ changesOnly: z.boolean() })
  ),
  execute: async ({ inputData, runtimeContext, tracingContext }) => {
    const { changesOnly, distroId } = inputData;
    const result = await getDistroTool.execute({
      context: { distroId },
      runtimeContext: runtimeContext || ({} as any),
      tracingContext: tracingContext || ({} as any),
    });
    return { ...result, changesOnly };
  },
});

const extractImageId = createStep({
  id: 'extractImageId',
  description: 'Extract imageId from distro data',
  inputSchema: z.intersection(
    getDistroTool.outputSchema,
    z.object({ changesOnly: z.boolean() })
  ),
  outputSchema: z.object({
    imageId: z.string(),
    changesOnly: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { changesOnly, distro } = inputData;

    if (!distro) {
      throw new Error('Cannot extract imageId: distro data is missing');
    }

    if (!distro.imageId) {
      throw new Error('Cannot extract imageId: distro.imageId is missing');
    }

    return {
      imageId: distro.imageId,
      changesOnly,
    };
  },
});

const getImageWithChangesOnly = createStep({
  id: 'getImageWithChangesOnly',
  description: 'Get image and pass through changesOnly flag',
  inputSchema: z.object({
    imageId: z.string(),
    changesOnly: z.boolean(),
  }),
  outputSchema: z.intersection(
    getImageTool.outputSchema,
    z.object({ changesOnly: z.boolean() })
  ),
  execute: async ({ inputData, runtimeContext, tracingContext }) => {
    const { changesOnly, imageId } = inputData;
    const result = await getImageTool.execute({
      context: { imageId },
      runtimeContext: runtimeContext || ({} as any),
      tracingContext: tracingContext || ({} as any),
    });
    return { ...result, changesOnly };
  },
});

const extractImageChanges = createStep({
  id: 'extractImageChanges',
  description: 'Extract recent changes from image data',
  inputSchema: getImageTool.outputSchema,
  outputSchema: z.object({
    image: z.object({
      id: z.string(),
      ami: z.string(),
      lastDeployed: z.date(),
      recentChanges: z.array(
        z.object({
          timestamp: z.date(),
          amiAfter: z.string(),
          amiBefore: z.string().optional().nullable(),
          entries: z.array(
            z.object({
              type: z.string(),
              action: z.string(),
              name: z.string(),
              before: z.string(),
              after: z.string(),
            })
          ),
        })
      ),
    }),
  }),
  execute: async ({ inputData }) => {
    const { image } = inputData;

    if (!image) {
      throw new Error('Cannot extract changes: image data is missing');
    }

    // Return image with focus on changes
    return {
      image: {
        id: image.id,
        ami: image.ami,
        lastDeployed: image.lastDeployed,
        recentChanges: image.events.eventLogEntries,
      },
    };
  },
});

const conditionalExtract = createStep({
  id: 'conditionalExtract',
  description:
    'Conditionally extract changes or return full image based on changesOnly flag',
  inputSchema: z.intersection(
    getImageTool.outputSchema,
    z.object({ changesOnly: z.boolean() })
  ),
  outputSchema: z.union([
    getImageTool.outputSchema,
    extractImageChanges.outputSchema,
  ]),
  execute: async ({ inputData }) => {
    const { changesOnly, image } = inputData;

    if (!image) {
      throw new Error('Cannot extract: image data is missing');
    }

    if (changesOnly) {
      return {
        image: {
          id: image.id,
          ami: image.ami,
          lastDeployed: image.lastDeployed,
          recentChanges: image.events.eventLogEntries,
        },
      };
    }

    return { image };
  },
});

const workflowInputSchema = z.object({
  taskId: z.string().optional(),
  execution: z.number().optional(),
  distroId: z.string().optional(),
  changesOnly: z.boolean().optional().default(false),
});

const getImageWorkflow = createWorkflow({
  id: 'getImage',
  description:
    'Unified workflow to retrieve image/AMI information from Evergreen. Can start from either a taskId or distroId. Gets the distro to find the associated imageId, then retrieves full image information including packages, toolchains, changes, and operating system details. Optionally returns only recent changes if changesOnly is true.',
  inputSchema: workflowInputSchema,
  outputSchema: z.union([
    getImageTool.outputSchema,
    extractImageChanges.outputSchema,
  ]),
})
  .then(routeToDistro)
  .then(getDistroWithChangesOnly)
  .then(extractImageId)
  .then(getImageWithChangesOnly)
  .then(conditionalExtract)
  .commit();

export default getImageWorkflow;

import { createWorkflow, createStep } from '@mastra/core';
import { z } from 'zod';
import { getDistroTool, getImageTool } from '@/mastra/tools/evergreen';

const getDistroStep = createStep(getDistroTool);

const extractImageIdStep = createStep({
  id: 'extract-image-id',
  description: 'Extract imageId from distro data',
  inputSchema: getDistroStep.outputSchema,
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

const getImageStep = createStep({
  ...getImageTool,
  inputSchema: z.object({
    imageId: z.string(),
  }),
});

const getImageByDistroWorkflow = createWorkflow({
  id: 'image-by-distro-workflow',
  description:
    'Workflow to retrieve image/AMI information from Evergreen starting from a distro ID. Gets the distro to find the associated imageId, then retrieves full image information including packages, toolchains, changes, and operating system details.',
  inputSchema: getDistroStep.inputSchema,
  outputSchema: getImageStep.outputSchema,
})
  .then(getDistroStep)
  .then(extractImageIdStep)
  .then(getImageStep)
  .commit();

export default getImageByDistroWorkflow;

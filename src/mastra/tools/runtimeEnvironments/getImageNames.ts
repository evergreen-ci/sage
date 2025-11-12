import { createTool } from '@mastra/core';
import { z } from 'zod';
import runtimeEnvironmentsClient from '@/utils/runtimeEnvironments/client';

const outputSchema = z.object({
  images: z.array(z.string()),
  count: z.number(),
});

/**
 * Tool to get all available runtime environment image names
 */
export const getImageNamesTool = createTool({
  id: 'getImageNames',
  description: `Get all available runtime environment image names from Evergreen.

  Use this tool when the user asks about:
  - Available images or AMIs
  - What operating systems are available
  - List of runtime environments

  Returns an array of image IDs like ["ubuntu2204", "rhel8", "amazon-linux-2"]`,

  inputSchema: z.object({}),
  outputSchema,

  execute: async () => {
    const images = await runtimeEnvironmentsClient.getImageNames();

    return {
      images,
      count: images.length,
    };
  },
});

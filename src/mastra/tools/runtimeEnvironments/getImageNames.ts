import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GetImagesQuery } from '@/gql/generated/types';
import { USER_ID } from '@/mastra/agents/constants';
import evergreenClient from '@/mastra/tools/evergreen/graphql/evergreenClient';
import logger from '@/utils/logger';
import { GET_IMAGES } from './graphql/queries';

const outputSchema = z.object({
  images: z.array(z.string()),
  count: z.number(),
});

/**
 * Tool to get all available runtime environment image names
 */
export const getImageNamesTool = createTool({
  id: 'getImageNames',
  description: `Get all available image names from Evergreen.

  Use this tool when the user asks about:
  - Available images or AMIs
  - What operating systems are available
  - List of images

  Returns an array of image IDs like ["ubuntu2204", "rhel8", "amazon-linux-2"]`,

  inputSchema: z.object({}),
  outputSchema,

  execute: async (_, context) => {
    try {
      const userId = context?.requestContext?.get(USER_ID) as string;
      const result = await evergreenClient.executeQuery<GetImagesQuery>(
        GET_IMAGES,
        {},
        { userID: userId }
      );

      return {
        images: result.images,
        count: result.images.length,
      };
    } catch (error) {
      logger.error('getImageNames tool failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

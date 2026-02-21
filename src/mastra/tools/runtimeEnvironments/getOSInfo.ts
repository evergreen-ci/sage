import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GetImageOsQuery } from '@/gql/generated/types';
import { USER_ID } from '@/mastra/agents/constants';
import evergreenClient from '@/mastra/tools/evergreen/graphql/evergreenClient';
import logger from '@/utils/logger';
import { GET_IMAGE_OS } from './graphql/queries';
import { imageIdSchema } from './schemas';

const inputSchema = imageIdSchema.extend({
  osName: z
    .string()
    .optional()
    .describe('Optional filter by OS name (e.g., "Ubuntu")'),
  page: z.number().optional().describe('Page number for pagination'),
  limit: z
    .number()
    .optional()
    .describe('Number of results per page (default: all)'),
});

const outputSchema = z.object({
  os_info: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
    })
  ),
  filtered_count: z.number(),
  total_count: z.number(),
});

/**
 * Tool to get operating system information for a specific image
 */
export const getOSInfoTool = createTool({
  id: 'getOSInfo',
  description: `Get operating system information for a specific image.

  Use this tool when the user asks about:
  - What OS is running on an image
  - OS version details
  - Operating system specifications

  Accepts image names (e.g., "ubuntu2204").

  Example: "What operating system is on ubuntu2204?"
  Returns OS name and version (e.g., Ubuntu 22.04)`,

  inputSchema,
  outputSchema,

  execute: async (inputData, context) => {
    try {
      const userId = context?.requestContext?.get(USER_ID) as string;
      const result = await evergreenClient.executeQuery<GetImageOsQuery>(
        GET_IMAGE_OS,
        {
          imageId: inputData.imageId,
          opts: {
            name: inputData.osName,
            page: inputData.page,
            limit: inputData.limit,
          },
        },
        { userID: userId }
      );

      const os = result.image?.operatingSystem;
      return {
        os_info: os?.data ?? [],
        filtered_count: os?.filteredCount ?? 0,
        total_count: os?.totalCount ?? 0,
      };
    } catch (error) {
      logger.error('getOSInfo tool failed', {
        input: inputData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

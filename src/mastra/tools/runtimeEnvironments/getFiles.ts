import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GetImageFilesQuery } from '@/gql/generated/types';
import { USER_ID } from '@/mastra/agents/constants';
import evergreenClient from '@/mastra/tools/evergreen/graphql/evergreenClient';
import logger from '@/utils/logger';
import { GET_IMAGE_FILES } from './graphql/queries';
import { imageIdSchema } from './schemas';

const inputSchema = imageIdSchema.extend({
  fileName: z
    .string()
    .optional()
    .describe(
      'Optional filter by file name (e.g., "certificate.pem", "config")'
    ),
  page: z.number().optional().describe('Page number for pagination'),
  limit: z
    .number()
    .optional()
    .describe('Number of results per page (default: 50)'),
});

const outputSchema = z.object({
  files: z.array(
    z.object({
      name: z.string(),
      version: z.string().describe('SHA-256 hash of the file'),
      path: z.string().describe('File path/location'),
    })
  ),
  filtered_count: z.number(),
  total_count: z.number(),
  summary: z.string(),
});

/**
 * Tool to get files present in a specific image
 */
export const getFilesTool = createTool({
  id: 'getFiles',
  description: `Get tracked files present in a specific image runtime environment.

  Use this tool when the user asks about:
  - Configuration files in an environment
  - Certificates or credentials
  - Specific file locations
  - File availability or presence

  Accepts image names (e.g., "ubuntu2204").

  Example: "Are SSL certificates present on ubuntu2204?"
  Example: "What config files are tracked in rhel8?"

  Returns file names, SHA-256 hashes (version), and file paths.
  Note: Only tracks specific important files, not all filesystem contents.`,

  inputSchema,
  outputSchema,

  execute: async (inputData, context) => {
    try {
      const userId = context?.requestContext?.get(USER_ID) as string;
      const result = await evergreenClient.executeQuery<GetImageFilesQuery>(
        GET_IMAGE_FILES,
        {
          imageId: inputData.imageId,
          opts: {
            name: inputData.fileName,
            page: inputData.page,
            limit: inputData.limit ?? 50,
          },
        },
        { userID: userId }
      );

      const files = result.image?.files;
      const filteredCount = files?.filteredCount ?? 0;
      const totalCount = files?.totalCount ?? 0;

      const summary = `Found ${filteredCount} files${
        inputData.fileName ? ` matching "${inputData.fileName}"` : ''
      } out of ${totalCount} total tracked files.`;

      return {
        files: files?.data ?? [],
        filtered_count: filteredCount,
        total_count: totalCount,
        summary,
      };
    } catch (error) {
      logger.error('getFiles tool failed', {
        input: inputData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

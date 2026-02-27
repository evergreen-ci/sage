import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GetImagePackagesQuery } from '@/gql/generated/types';
import { USER_ID } from '@/mastra/agents/constants';
import evergreenClient from '@/mastra/tools/evergreen/graphql/evergreenClient';
import logger from '@/utils/logger';
import { GET_IMAGE_PACKAGES } from './graphql/queries';
import { imageIdSchema } from './schemas';

const inputSchema = imageIdSchema.extend({
  packageName: z
    .string()
    .optional()
    .describe('Optional filter by package name (e.g., "python", "numpy")'),
  manager: z
    .string()
    .optional()
    .describe('Optional filter by package manager (e.g., "pip", "apt", "npm")'),
  page: z.number().optional().describe('Page number for pagination'),
  limit: z
    .number()
    .optional()
    .describe('Number of results per page (default: 50)'),
});

const outputSchema = z.object({
  packages: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
      manager: z.string(),
    })
  ),
  filtered_count: z.number(),
  total_count: z.number(),
  summary: z.string(),
});

/**
 * Tool to get installed packages for a specific image
 */
export const getPackagesTool = createTool({
  id: 'getPackages',
  description: `Get installed packages for a specific image runtime environment.

  Use this tool when the user asks about:
  - What packages are installed on an image
  - Package versions (Python, Node.js libraries, system packages)
  - Checking if a specific package is installed

  Example: "What Python packages are available on ubuntu2204?"
  Example: "Is numpy installed on ubuntu2204?"

  Returns package names, versions, and the package manager used (pip, apt, npm, etc.)`,

  inputSchema,
  outputSchema,

  execute: async (inputData, context) => {
    try {
      const userId = context?.requestContext?.get(USER_ID) as string;
      const result = await evergreenClient.executeQuery<GetImagePackagesQuery>(
        GET_IMAGE_PACKAGES,
        {
          imageId: inputData.imageId,
          opts: {
            name: inputData.packageName,
            manager: inputData.manager,
            page: inputData.page,
            limit: inputData.limit ?? 50,
          },
        },
        { userID: userId }
      );

      const packages = result?.image?.packages;
      const filteredCount = packages?.filteredCount ?? 0;
      const totalCount = packages?.totalCount ?? 0;

      const summary = `Found ${filteredCount} packages${
        inputData.packageName ? ` matching "${inputData.packageName}"` : ''
      }${inputData.manager ? ` (manager: ${inputData.manager})` : ''} out of ${totalCount} total packages.`;

      return {
        packages: packages?.data ?? [],
        filtered_count: filteredCount,
        total_count: totalCount,
        summary,
      };
    } catch (error) {
      logger.error('getPackages tool failed', {
        input: inputData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

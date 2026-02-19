import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GetImageToolchainsQuery } from '@/gql/generated/types';
import { USER_ID } from '@/mastra/agents/constants';
import evergreenClient from '@/mastra/tools/evergreen/graphql/evergreenClient';
import logger from '@/utils/logger';
import { GET_IMAGE_TOOLCHAINS } from './graphql/queries';
import { imageIdSchema } from './schemas';

const inputSchema = imageIdSchema.extend({
  toolchainName: z
    .string()
    .optional()
    .describe(
      'Optional filter by toolchain name (e.g., "golang", "python", "node")'
    ),
  page: z.number().optional().describe('Page number for pagination'),
  limit: z
    .number()
    .optional()
    .describe('Number of results per page (default: 50)'),
});

const outputSchema = z.object({
  toolchains: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
      path: z.string().describe('Path or location of the toolchain'),
    })
  ),
  filtered_count: z.number(),
  total_count: z.number(),
  summary: z.string(),
});

/**
 * Tool to get installed toolchains (compilers, runtimes) for a specific image
 */
export const getToolchainsTool = createTool({
  id: 'getToolchains',
  description: `Get installed toolchains (compilers, language runtimes) for a specific image.

  Use this tool when the user asks about:
  - What compilers or language runtimes are available
  - Go, Python, Node.js, Java versions installed
  - Build tool availability

  Accepts image names (e.g., "ubuntu2204").

  Example: "What version of Go is on ubuntu2204?"
  Example: "What toolchains are available on rhel8?"

  Returns toolchain names, versions, and installation paths.`,

  inputSchema,
  outputSchema,

  execute: async (inputData, context) => {
    try {
      const userId = context?.requestContext?.get(USER_ID) as string;
      const result =
        await evergreenClient.executeQuery<GetImageToolchainsQuery>(
          GET_IMAGE_TOOLCHAINS,
          {
            imageId: inputData.imageId,
            opts: {
              name: inputData.toolchainName,
              page: inputData.page,
              limit: inputData.limit ?? 50,
            },
          },
          { userID: userId }
        );

      const toolchains = result.image?.toolchains;
      const filteredCount = toolchains?.filteredCount ?? 0;
      const totalCount = toolchains?.totalCount ?? 0;

      const summary = `Found ${filteredCount} toolchains${
        inputData.toolchainName ? ` matching "${inputData.toolchainName}"` : ''
      } out of ${totalCount} total toolchains.`;

      return {
        toolchains: toolchains?.data ?? [],
        filtered_count: filteredCount,
        total_count: totalCount,
        summary,
      };
    } catch (error) {
      logger.error('getToolchains tool failed', {
        input: inputData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

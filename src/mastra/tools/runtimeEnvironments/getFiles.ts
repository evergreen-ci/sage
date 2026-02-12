import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import logger from '@/utils/logger';
import runtimeEnvironmentsClient from '@/utils/runtimeEnvironments/client';
import { imageIdentifierSchema, resolveImageIdentifier } from './schemas';

const inputSchema = imageIdentifierSchema.and(
  z.object({
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
  })
);

const outputSchema = z.object({
  files: z.array(
    z.object({
      name: z.string(),
      version: z.string().describe('SHA-256 hash of the file'),
      manager: z.string().describe('File path/location'),
    })
  ),
  filtered_count: z.number(),
  total_count: z.number(),
  summary: z.string(),
});

/**
 * Tool to get files present in a specific AMI
 */
export const getFilesTool = createTool({
  id: 'getFiles',
  description: `Get tracked files present in a specific AMI or image runtime environment.

  Use this tool when the user asks about:
  - Configuration files in an environment
  - Certificates or credentials
  - Specific file locations
  - File availability or presence

  Accepts both AMI IDs (e.g., "ami-12345678") and image names (e.g., "ubuntu2204").

  Example: "Are SSL certificates present on ubuntu2204?"
  Example: "What config files are tracked in ami-12345678?"

  Returns file names, SHA-256 hashes (version), and file paths.
  Note: Only tracks specific important files, not all filesystem contents.`,

  inputSchema,
  outputSchema,

  execute: async inputData => {
    try {
      const response = await runtimeEnvironmentsClient.getFiles({
        ...resolveImageIdentifier(inputData),
        fileName: inputData.fileName,
        page: inputData.page,
        limit: inputData.limit ?? 50,
      });

      const summary = `Found ${response.filtered_count} files${
        inputData.fileName ? ` matching "${inputData.fileName}"` : ''
      } out of ${response.total_count} total tracked files.`;

      return {
        files: response.data,
        filtered_count: response.filtered_count,
        total_count: response.total_count,
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

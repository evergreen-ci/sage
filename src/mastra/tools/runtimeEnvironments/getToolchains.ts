import { createTool } from '@mastra/core';
import { z } from 'zod';
import runtimeEnvironmentsClient from '@/utils/runtimeEnvironments/client';

const inputSchema = z
  .object({
    name: z.string().optional().describe('Image name (e.g., "ubuntu2204")'),
    id: z.string().optional().describe('AMI ID (e.g., "ami-12345678")'),
    toolchainName: z
      .string()
      .optional()
      .describe(
        'Optional filter by toolchain name (e.g., "golang", "python", "node")'
      ),
    version: z
      .string()
      .optional()
      .describe('Optional filter by specific version (e.g., "1.20.0")'),
    page: z.number().optional().describe('Page number for pagination'),
    limit: z
      .number()
      .optional()
      .describe('Number of results per page (default: 50)'),
  })
  .refine(data => data.name || data.id, {
    message: 'Either name or id must be provided',
  })
  .refine(data => !(data.name && data.id), {
    message: 'Cannot provide both name and id',
  });

const outputSchema = z.object({
  toolchains: z.array(
    z.object({
      name: z.string(),
      version: z.string(),
      manager: z.string().describe('Path or location of the toolchain'),
    })
  ),
  filtered_count: z.number(),
  total_count: z.number(),
  summary: z.string(),
});

/**
 * Tool to get installed toolchains (compilers, runtimes) for a specific AMI
 */
export const getToolchainsTool = createTool({
  id: 'getToolchains',
  description: `Get installed toolchains (compilers, language runtimes) for a specific AMI or image.

  Use this tool when the user asks about:
  - What compilers or language runtimes are available
  - Go, Python, Node.js, Java versions installed
  - Development environment details
  - Build tool availability

  Accepts both AMI IDs (e.g., "ami-12345678") and image names (e.g., "ubuntu2204").

  Example: "What version of Go is on ubuntu2204?"
  Example: "What toolchains are available on ami-12345678?"

  Returns toolchain names, versions, and installation paths.`,

  inputSchema,
  outputSchema,

  execute: async ({ context }) => {
    const response = await runtimeEnvironmentsClient.getToolchains({
      ...(context.name ? { name: context.name } : { id: context.id! }),
      toolchainName: context.toolchainName,
      version: context.version,
      page: context.page,
      limit: context.limit ?? 50,
    });

    const summary = `Found ${response.filtered_count} toolchains${
      context.toolchainName ? ` matching "${context.toolchainName}"` : ''
    }${context.version ? ` (version: ${context.version})` : ''} out of ${response.total_count} total toolchains.`;

    return {
      toolchains: response.data,
      filtered_count: response.filtered_count,
      total_count: response.total_count,
      summary,
    };
  },
});

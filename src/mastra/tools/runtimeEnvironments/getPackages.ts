import { createTool } from '@mastra/core';
import { z } from 'zod';
import runtimeEnvironmentsClient from '@/utils/runtimeEnvironments/client';

const inputSchema = z
  .object({
    name: z.string().optional().describe('Image name (e.g., "ubuntu2204")'),
    id: z.string().optional().describe('AMI ID (e.g., "ami-12345678")'),
    packageName: z
      .string()
      .optional()
      .describe('Optional filter by package name (e.g., "python", "numpy")'),
    manager: z
      .string()
      .optional()
      .describe(
        'Optional filter by package manager (e.g., "pip", "apt", "npm")'
      ),
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
 * Tool to get installed packages for a specific AMI
 */
export const getPackagesTool = createTool({
  id: 'getPackages',
  description: `Get installed packages for a specific AMI or image runtime environment.

  Use this tool when the user asks about:
  - What packages are installed on an AMI/image
  - Package versions (Python, Node.js libraries, system packages)
  - Dependencies available in an environment
  - Checking if a specific package is installed

  Accepts both AMI IDs (e.g., "ami-12345678") and image names (e.g., "ubuntu2204").

  Example: "What Python packages are available on ubuntu2204?"
  Example: "Is numpy installed on ami-12345678?"

  Returns package names, versions, and the package manager used (pip, apt, npm, etc.)`,

  inputSchema,
  outputSchema,

  execute: async ({ context }) => {
    const response = await runtimeEnvironmentsClient.getPackages({
      ...(context.name ? { name: context.name } : { id: context.id! }),
      packageName: context.packageName,
      manager: context.manager,
      page: context.page,
      limit: context.limit ?? 50,
    });

    const summary = `Found ${response.filtered_count} packages${
      context.packageName ? ` matching "${context.packageName}"` : ''
    }${context.manager ? ` (manager: ${context.manager})` : ''} out of ${response.total_count} total packages.`;

    return {
      packages: response.data,
      filtered_count: response.filtered_count,
      total_count: response.total_count,
      summary,
    };
  },
});

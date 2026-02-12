import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import runtimeEnvironmentsClient from '@/utils/runtimeEnvironments/client';

const inputSchema = z
  .object({
    name: z.string().optional().describe('Image name (e.g., "ubuntu2204")'),
    id: z.string().optional().describe('AMI ID (e.g., "ami-12345678")'),
    osName: z
      .string()
      .optional()
      .describe('Optional filter by OS name (e.g., "Ubuntu")'),
    page: z.number().optional().describe('Page number for pagination'),
    limit: z
      .number()
      .optional()
      .describe('Number of results per page (default: all)'),
  })
  .refine(data => data.name || data.id, {
    message: 'Either name or id must be provided',
  })
  .refine(data => !(data.name && data.id), {
    message: 'Cannot provide both name and id',
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
 * Tool to get operating system information for a specific AMI
 */
export const getOSInfoTool = createTool({
  id: 'getOSInfo',
  description: `Get operating system information for a specific AMI or image.

  Use this tool when the user asks about:
  - What OS is running on an AMI or image
  - OS version details
  - Operating system specifications

  Accepts both AMI IDs (e.g., "ami-12345678") and image names (e.g., "ubuntu2204").

  Example: "What operating system is on ubuntu2204?"
  Example: "What OS is running on ami-12345678?"
  Returns OS name and version (e.g., Ubuntu 22.04)`,

  inputSchema,
  outputSchema,

  execute: async inputData => {
    const response = await runtimeEnvironmentsClient.getOSInfo({
      ...(inputData.name ? { name: inputData.name } : { id: inputData.id! }),
      osName: inputData.osName,
      page: inputData.page,
      limit: inputData.limit,
    });

    return {
      os_info: response.data,
      filtered_count: response.filtered_count,
      total_count: response.total_count,
    };
  },
});

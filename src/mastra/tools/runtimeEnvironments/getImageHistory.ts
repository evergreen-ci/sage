import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import runtimeEnvironmentsClient from '@/utils/runtimeEnvironments/client';

const inputSchema = z.object({
  image_id: z
    .string()
    .describe('Image ID (e.g., "ubuntu2204", "rhel8", "amazon-linux-2")'),
  page: z.number().optional().describe('Page number for pagination'),
  limit: z
    .number()
    .optional()
    .describe('Number of results per page (default: 10)'),
});

const outputSchema = z.object({
  history: z.array(
    z.object({
      ami_id: z.string(),
      created_date: z.string().describe('ISO 8601 timestamp'),
      days_ago: z.number(),
    })
  ),
  total_count: z.number(),
  summary: z.string(),
});

/**
 * Tool to get historical AMI versions for an image
 */
export const getImageHistoryTool = createTool({
  id: 'getImageHistory',
  description: `Get historical AMI versions for an image ID, ordered from most recent to oldest.

  Use this tool when the user asks about:
  - AMI version history for an image
  - When an image was last updated
  - Previous versions of a runtime environment
  - Timeline of environment changes

  Example: "What's the AMI history for ubuntu2204?"
  Example: "When was rhel8 last updated?"
  Example: "Show me the last 5 versions of amazon-linux-2"

  Returns AMI identifiers and deployment timestamps in chronological order.
  Useful for understanding environment changes over time or investigating when issues started.`,

  inputSchema,
  outputSchema,

  execute: async inputData => {
    const response = await runtimeEnvironmentsClient.getImageHistory(
      inputData.image_id,
      inputData.page,
      inputData.limit ?? 10
    );

    const now = Date.now();
    const history = response.data.map(item => ({
      ami_id: item.ami_id,
      created_date: new Date(item.created_date * 1000).toISOString(),
      days_ago: Math.floor(
        (now - item.created_date * 1000) / (1000 * 60 * 60 * 24)
      ),
    }));

    const latestDate =
      history.length > 0
        ? new Date(response.data[0].created_date * 1000).toLocaleDateString()
        : 'unknown';

    const summary = `Found ${response.total_count} historical versions for ${inputData.image_id}. Most recent: ${history[0]?.ami_id || 'none'} (deployed ${latestDate}).`;

    return {
      history,
      total_count: response.total_count,
      summary,
    };
  },
});

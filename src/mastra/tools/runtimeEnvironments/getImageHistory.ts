import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GetImageHistoryQuery } from '@/gql/generated/types';
import { USER_ID } from '@/mastra/agents/constants';
import evergreenClient from '@/mastra/tools/evergreen/graphql/evergreenClient';
import logger from '@/utils/logger';
import { GET_IMAGE_HISTORY } from './graphql/queries';
import { imageIdSchema } from './schemas';

const inputSchema = imageIdSchema.extend({
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
 * Tool to get historical AMI versions for an image.
 * Derives AMI history from event transitions: each event's amiAfter
 * represents a deployed AMI version at the event's timestamp.
 */
export const getImageHistoryTool = createTool({
  id: 'getImageHistory',
  description: `Get historical AMI versions for an image ID, ordered from most recent to oldest.

  Use this tool when the user asks about:
  - AMI version history for an image
  - When an image was last updated
  - Previous versions of an image
  - Timeline of image changes

  Example: "What's the AMI history for ubuntu2204?"
  Example: "When was rhel8 last updated?"
  Example: "Show me the last 5 versions of amazon-linux-2"

  Returns AMI identifiers and deployment timestamps ordered from most recent to oldest.
  Useful for understanding image changes over time or investigating when issues started.`,

  inputSchema,
  outputSchema,

  execute: async (inputData, context) => {
    try {
      const userId = context?.requestContext?.get(USER_ID) as string;
      const limit = inputData.limit ?? 10;
      const result = await evergreenClient.executeQuery<GetImageHistoryQuery>(
        GET_IMAGE_HISTORY,
        {
          imageId: inputData.imageId,
          limit,
          page: inputData.page ?? 0,
        },
        { userID: userId }
      );

      const eventsPayload = result.image?.events;
      const entries = eventsPayload?.eventLogEntries ?? [];
      const totalCount = eventsPayload?.count ?? 0;

      const now = Date.now();
      const history = entries.map(entry => {
        const ts = new Date(entry.timestamp).getTime();
        return {
          ami_id: entry.amiAfter,
          created_date: new Date(entry.timestamp).toISOString(),
          days_ago: Math.floor((now - ts) / (1000 * 60 * 60 * 24)),
        };
      });

      let summary: string;
      if (history.length === 0 && totalCount > 0) {
        summary = `Found ${totalCount} historical versions for ${inputData.imageId}, but no results on this page. Try an earlier page.`;
      } else if (history.length === 0) {
        summary = `No historical versions found for ${inputData.imageId}.`;
      } else {
        const latestDate = new Date(
          history[0].created_date
        ).toLocaleDateString();
        summary = `Found ${totalCount} historical versions for ${inputData.imageId}. Most recent on this page: ${history[0].ami_id} (deployed ${latestDate}).`;
      }

      return {
        history,
        total_count: totalCount,
        summary,
      };
    } catch (error) {
      logger.error('getImageHistory tool failed', {
        input: inputData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

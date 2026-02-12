import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import logger from '@/utils/logger';
import runtimeEnvironmentsClient from '@/utils/runtimeEnvironments/client';

const inputSchema = z.object({
  image_id: z
    .string()
    .describe('Image ID (e.g., "ubuntu2204", "rhel8", "amazon-linux-2")'),
  limit: z
    .number()
    .default(5)
    .describe('Number of events/transitions to retrieve (default: 5)'),
  page: z.number().optional().describe('Page number for pagination'),
});

const outputSchema = z.object({
  events: z.array(
    z.object({
      timestamp: z.string().describe('ISO 8601 timestamp'),
      ami_before: z.string(),
      ami_after: z.string(),
      changes: z.array(
        z.object({
          name: z.string(),
          before: z.string(),
          after: z.string(),
          type: z.enum(['OS', 'Packages', 'Toolchains', 'Files']),
          action: z.enum(['ADDED', 'UPDATED', 'DELETED']),
        })
      ),
      summary: z.object({
        total: z.number(),
        added: z.number(),
        updated: z.number(),
        deleted: z.number(),
      }),
    })
  ),
  description: z.string(),
});

/**
 * Tool to get chronological change events for an image
 */
export const getImageEventsTool = createTool({
  id: 'getImageEvents',
  description: `Get chronological change events showing what changed between AMI versions over time.

  Use this tool when the user asks about:
  - Change history for an image
  - When specific packages or toolchains were added/updated/removed
  - Timeline of AMI changes
  - Investigating when breaking changes were introduced

  Example: "What changed in ubuntu2204 over the last month?"
  Example: "Show me the change history for rhel8"
  Example: "When was Python upgraded in amazon-linux-2?"

  Returns detailed events showing:
  - Timestamp of each AMI transition
  - Before/after AMI identifiers
  - All changes (packages, toolchains, OS, files)
  - Actions taken (ADDED, UPDATED, DELETED)

  This is extremely useful for root cause analysis when builds start failing after image updates.`,

  inputSchema,
  outputSchema,

  execute: async inputData => {
    try {
      const rawEvents = await runtimeEnvironmentsClient.getEvents({
        image: inputData.image_id,
        limit: inputData.limit,
        page: inputData.page,
      });

      const events = rawEvents.map(event => {
        const summary = {
          total: event.entries.length,
          added: event.entries.filter(e => e.action === 'ADDED').length,
          updated: event.entries.filter(e => e.action === 'UPDATED').length,
          deleted: event.entries.filter(e => e.action === 'DELETED').length,
        };

        return {
          timestamp: event.timestamp.toISOString(),
          ami_before: event.ami_before,
          ami_after: event.ami_after,
          changes: event.entries.map(entry => ({
            name: entry.name,
            before: entry.before,
            after: entry.after,
            type: entry.type,
            action: entry.action,
          })),
          summary,
        };
      });

      const totalChanges = events.reduce((sum, e) => sum + e.summary.total, 0);
      const description = `Retrieved ${events.length} change events for ${inputData.image_id} with ${totalChanges} total changes across all transitions.`;

      return {
        events,
        description,
      };
    } catch (error) {
      logger.error('getImageEvents tool failed', {
        input: inputData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

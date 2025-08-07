import { createTool } from '@mastra/core';
import { z } from 'zod';
import getTaskHistoryTool from '../evergreen/getTaskHistory';

const TaskHistoryDirectionEnum = z.enum(['AFTER', 'BEFORE']);

const CursorParamsSchema = z.object({
  cursorId: z.string(),
  direction: TaskHistoryDirectionEnum,
  includeCursor: z.boolean(),
});

const TaskHistoryOptsSchema = z.object({
  buildVariant: z.string(),
  cursorParams: CursorParamsSchema,
  date: z.union([z.string().datetime(), z.date()]).optional(),
  limit: z.number().optional(),
  projectIdentifier: z.string(),
  taskName: z.string(),
});

/**
 * This is an adapter tool that wraps around getTaskHistoryTool
 * to make it easier to use in workflows
 */
const taskHistoryToolAdapter = createTool({
  id: 'taskHistoryToolAdapter',
  description:
    'Adapter tool for getting Evergreen task history information to use in workflows',
  inputSchema: TaskHistoryOptsSchema,
  execute: async ({ context, runtimeContext }) => {
    try {
      // Call the getTaskHistoryTool's execute function with proper context
      if (getTaskHistoryTool.execute) {
        // Return the result directly
        return await getTaskHistoryTool.execute({
          context,
          runtimeContext,
        });
      }
      throw new Error('getTaskHistoryTool.execute is not defined');
    } catch (error) {
      console.error('Error executing getTaskHistoryTool:', error);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

export default taskHistoryToolAdapter;
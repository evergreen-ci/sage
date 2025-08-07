import { createTool } from '@mastra/core';
import { z } from 'zod';
import getTaskTool from '../evergreen/getTask';

// Input schema matches getTaskTool
const taskToolAdapterInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

/**
 * This is an adapter tool that wraps around getTaskTool
 * to make it easier to use in workflows
 */
const taskToolAdapter = createTool({
  id: 'taskToolAdapter',
  description:
    'Adapter tool for getting Evergreen task information to use in workflows',
  inputSchema: taskToolAdapterInputSchema,
  execute: async ({ context, runtimeContext }) => {
    const { execution, taskId } = context;

    try {
      // Call the getTaskTool's execute function with proper context
      if (getTaskTool.execute) {
        // Return the result directly
        return await getTaskTool.execute({
          context: {
            taskId,
            execution,
          },
          runtimeContext,
        });
      }
      throw new Error('getTaskTool.execute is not defined');
    } catch (error) {
      console.error('Error executing getTaskTool:', error);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

export default taskToolAdapter;

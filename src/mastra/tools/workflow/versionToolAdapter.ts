import { createTool } from '@mastra/core';
import { z } from 'zod';
import getVersionTool from '../evergreen/getVersion';

// Input schema matches getVersionTool
const versionToolAdapterInputSchema = z.object({
  id: z.string(),
  includeNeverActivatedTasks: z.boolean().optional(),
});

/**
 * This is an adapter tool that wraps around getVersionTool
 * to make it easier to use in workflows
 */
const versionToolAdapter = createTool({
  id: 'versionToolAdapter',
  description:
    'Adapter tool for getting Evergreen version information to use in workflows',
  inputSchema: versionToolAdapterInputSchema,
  execute: async ({ context, runtimeContext }) => {
    const { id, includeNeverActivatedTasks } = context;

    try {
      // Call the getVersionTool's execute function with proper context
      if (getVersionTool.execute) {
        // Return the result directly
        return await getVersionTool.execute({
          context: {
            id,
            includeNeverActivatedTasks,
          },
          runtimeContext,
        });
      }
      throw new Error('getVersionTool.execute is not defined');
    } catch (error) {
      console.error('Error executing getVersionTool:', error);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

export default versionToolAdapter;
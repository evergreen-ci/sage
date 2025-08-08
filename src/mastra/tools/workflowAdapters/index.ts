import { createTool, ToolAction } from '@mastra/core';
import { z } from 'zod';
import { logger } from '../../../utils/logger';
import getTaskTool from '../evergreen/getTask';
import getTaskFilesTool from '../evergreen/getTaskFiles';
import getTaskHistoryTool from '../evergreen/getTaskHistory';
import getTaskTestsTool from '../evergreen/getTaskTests';
import getVersionTool from '../evergreen/getVersion';

/**
 * Creates a workflow adapter for a given tool
 * This is a factory function that creates simple tool adapters
 * that just pass through the context to the underlying tool
 * @param tool
 * @param options
 * @param options.id
 * @param options.description
 */
function createToolAdapter<TSchema extends z.ZodObject<any>>(
  tool: ToolAction<TSchema, any, any>,
  options?: {
    id?: string;
    description?: string;
  }
): ToolAction<TSchema, undefined, any> {
  if (!tool.inputSchema) {
    throw new Error(
      `Tool ${tool.id} must have an inputSchema to create an adapter`
    );
  }

  return createTool({
    id: options?.id || `${tool.id}Adapter`,
    description:
      options?.description || `Adapter tool for ${tool.id} to use in workflows`,
    inputSchema: tool.inputSchema,
    execute: async ({ context, runtimeContext }) => {
      try {
        if (tool.execute) {
          return await tool.execute({
            context,
            runtimeContext,
          });
        }
        throw new Error(`${tool.id}.execute is not defined`);
      } catch (error) {
        logger.error(`Error executing ${tool.id}:`, error);
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  }) as ToolAction<TSchema, undefined, any>;
}

export const taskFilesToolAdapter = createToolAdapter(getTaskFilesTool, {
  id: 'taskFilesToolAdapter',
  description:
    'Adapter tool for getting Evergreen task files information to use in workflows',
});

export const taskTestsToolAdapter = createToolAdapter(getTaskTestsTool, {
  id: 'taskTestsToolAdapter',
  description:
    'Adapter tool for getting Evergreen task tests information to use in workflows',
});

export const taskToolAdapter = createToolAdapter(getTaskTool, {
  id: 'taskToolAdapter',
  description:
    'Adapter tool for getting Evergreen task information to use in workflows',
});

export const versionToolAdapter = createToolAdapter(getVersionTool, {
  id: 'versionToolAdapter',
  description:
    'Adapter tool for getting Evergreen version information to use in workflows',
});

export const taskHistoryToolAdapter = createToolAdapter(getTaskHistoryTool, {
  id: 'taskHistoryToolAdapter',
  description:
    'Adapter tool for getting Evergreen task history information to use in workflows',
});

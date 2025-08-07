import { createTool, ToolAction } from '@mastra/core';
import { z } from 'zod';
import logger from '../../../utils/logger';

/**
 * Creates a workflow adapter for a given tool
 * This is a factory function that creates simple tool adapters
 * that just pass through the context to the underlying tool
 * @param tool
 * @param options
 * @param options.id
 * @param options.description
 */
export function createToolAdapter<TSchema extends z.ZodObject<any>>(
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

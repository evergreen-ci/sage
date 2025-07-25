import {
  createTool,
  Tool,
  ToolAction,
  ToolExecutionContext,
} from '@mastra/core';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { getMastraResolvedPath } from '../file';
import { logger } from '../logger';
import { evergreenGraphQLClient } from './evergreenGraphQLClient';

/**
 * Loads a GraphQL file from the given path
 * @param path - The path to the GraphQL file
 * @returns The contents of the GraphQL file
 */
export const loadGraphQLFile = (path: string) => {
  const resolvedPath = getMastraResolvedPath(path);
  let file = '';
  try {
    file = readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    logger.error(`Failed to load GraphQL file from ${resolvedPath}`);
    throw error;
  }
  logger.info(`Loaded GraphQL file from ${resolvedPath}`);

  return file;
};

interface GraphQLToolInput<
  TSchema extends z.ZodObject<any>,
  TExecutionContext extends ToolExecutionContext<TSchema>,
> extends Tool<TSchema, undefined, TExecutionContext> {
  query: string;
  id: string;
  inputSchema: TSchema;
  description: string;
}

/**
 * Creates a Mastra tool from a GraphQL query and input schema
 * @param param0 - The input schema
 * @param param0.query - The GraphQL query
 * @param param0.id - The ID of the tool
 * @param param0.inputSchema - The input schema
 * @param param0.description - The description of the tool
 * @returns A Mastra tool
 */
export const createGraphQLTool = <
  TSchema extends z.ZodObject<any>,
  TExecutionContext extends ToolExecutionContext<TSchema>,
>({
  description,
  id,
  inputSchema,
  query,
}: Omit<GraphQLToolInput<TSchema, TExecutionContext>, 'execute'>) =>
  createTool({
    id,
    inputSchema,
    description,
    execute: async ({ context, runtimeContext }) => {
      const userID = runtimeContext.get('userID') as string;
      if (typeof userID !== 'string') {
        logger.warn('User ID was not supplied to the tool', { id, userID });
      }
      try {
        const result = await evergreenGraphQLClient.executeQuery(
          query,
          context,
          {
            userID,
          }
        );
        return result;
      } catch (error) {
        logger.error(`Error executing GraphQL query: ${error}`);
        return {
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error occurred when running the GraphQL query',
        };
      }
    },
  }) as ToolAction<TSchema, any, TExecutionContext>;

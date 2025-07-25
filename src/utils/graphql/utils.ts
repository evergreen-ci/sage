import { createTool, Tool, ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../logger';
import { evergreenGraphQLClient } from './evergreenGraphQLClient';

/**
 * Loads a GraphQL file from the given path
 * @param path - The path to the GraphQL file
 * @returns The contents of the GraphQL file
 */
export const loadGraphQLFile = (path: string) => {
  // TODO: This is a hack to get the correct path to the GraphQL file
  // When running in the mastra directory, we need to go up 2 levels to get to the src directory
  // This is required due to a mismatch in how mastra and the express server handle module resolution
  const isInMastra = process.cwd().includes('.mastra');
  const resolvedPath = resolve(isInMastra ? '../../src' : './src', path);
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
              : 'Unknown error occured when running the GraphQL query',
        };
      }
    },
  });

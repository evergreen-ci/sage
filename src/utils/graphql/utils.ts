import { createTool, Tool } from '@mastra/core';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../logger';
import { evergreenGraphQLClient } from './evergreenGraphQLClient';
import { z } from "zod";

// __dirname is automatically available in CommonJS environments
/**
 * Loads a GraphQL file from the given path
 * @param path - The path to the GraphQL file
 * @returns The contents of the GraphQL file
 */
export const loadGraphQLFile = (path: string) => {
    const resolvedPath = resolve("./src", path);
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


interface GraphQLToolInput<TSchema extends z.ZodObject<any>> extends Tool<TSchema> {
  query: string;
  id: string;
  inputSchema: TSchema;
  description: string;
}

/**
 * Creates a Mastra tool from a GraphQL query and input schema
 * @param param0 - The input schema
 * @returns A Mastra tool
 */
export const createGraphQLTool = <
  TSchema extends z.ZodObject<any>
>({
  query,
  id,
  inputSchema,
  description,
}: GraphQLToolInput<TSchema>) => {
  return createTool({
    id,
    inputSchema,
    description,
    execute: async ({ context }) => {
      const result = await evergreenGraphQLClient.executeQuery(
        query,
        context
      );
      return result;
    },
  });
};

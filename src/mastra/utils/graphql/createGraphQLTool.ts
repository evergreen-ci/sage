import { createTool, ToolAction, ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import {
  GraphQLClient,
  GraphQLClientError,
} from '../../../utils/graphql/client'; // adjust path
import logger from '../../../utils/logger';

interface GraphQLToolInputParams<TSchema extends z.ZodObject<any>> {
  id: string;
  description: string;
  query: string;
  inputSchema: TSchema;
  client: GraphQLClient;
}

/**
 * Creates a Mastra tool from a GraphQL query and input schema, using a provided GraphQL client.
 * @param param0 - Tool configuration and GraphQL client
 * @param param0.id - The ID of the tool
 * @param param0.description - The description of the tool
 * @param param0.query - The GraphQL query to execute
 * @param param0.inputSchema - The input schema for the tool
 * @param param0.client - The GraphQL client to use
 * @returns A typed Mastra tool
 */
export const createGraphQLTool = <
  TSchema extends z.ZodObject<any>,
  TResult,
  TExecutionContext extends ToolExecutionContext<TSchema>,
>({
  client,
  description,
  id,
  inputSchema,
  query,
}: GraphQLToolInputParams<TSchema>) =>
  createTool({
    id,
    inputSchema,
    description,
    execute: async ({ context, runtimeContext }) => {
      const userID = runtimeContext.get('userID') as string | undefined;
      if (!userID) {
        logger.warn(
          'User ID not available in RuntimeContext provided to GraphQL tool',
          { id }
        );
      }

      const apiUser = runtimeContext.get('apiUser') as string | undefined;
      const apiKey = runtimeContext.get('apiKey') as string | undefined;

      const headers: Record<string, string> = {};
      if (apiUser) {
        headers['Api-User'] = apiUser;
      }
      if (apiKey) {
        headers['Api-Key'] = apiKey;
      }

      try {
        const result = await client.executeQuery<TResult>(query, context, {
          userID: userID ?? '',
          headers,
        });
        return result;
      } catch (error) {
        const baseError = {
          id,
          context,
          userID,
          error: error instanceof Error ? error.message : String(error),
        };

        if (error instanceof GraphQLClientError) {
          logger.error('GraphQLClientError during tool execution', {
            ...baseError,
            statusCode: error.statusCode,
            graphqlErrors: error.errors,
          });

          return {
            error: error.message,
            graphqlErrors: error.errors,
            statusCode: error.statusCode,
          };
        }

        logger.error(
          'Unexpected error during GraphQL tool execution',
          baseError
        );

        return {
          error: baseError.error,
        };
      }
    },
  }) as ToolAction<TSchema, undefined, TExecutionContext>;

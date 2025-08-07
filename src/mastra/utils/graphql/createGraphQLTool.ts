import { createTool, ToolAction, ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import {
  GraphQLClient,
  GraphQLClientError,
} from '../../../utils/graphql/client';
import logger from '../../../utils/logger';

interface GraphQLToolInputParams<TSchema extends z.ZodObject<any>> {
  id: string;
  description: string;
  query: string;
  inputSchema: TSchema;
  client: GraphQLClient;
  outputSchema?: z.ZodType<any>;
}

/**
 * Creates a Mastra tool from a GraphQL query and input schema, using a provided GraphQL client.
 * @param param0 - Tool configuration and GraphQL client
 * @param param0.id - The ID of the tool
 * @param param0.description - The description of the tool
 * @param param0.query - The GraphQL query to execute
 * @param param0.inputSchema - The input schema for the tool
 * @param param0.client - The GraphQL client to use
 * @param param0.outputSchema - Optional output schema for workflow compatibility
 * @returns A typed Mastra tool that can be used in both agents and workflows
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
  outputSchema = z.any(),
  query,
}: GraphQLToolInputParams<TSchema>) =>
  createTool({
    id,
    inputSchema,
    outputSchema,
    description,
    execute: async ({ context, runtimeContext }) => {
      const userID = runtimeContext.get('userID') as string | undefined;
      if (!userID) {
        logger.warn(
          'User ID not available in RuntimeContext provided to GraphQL tool',
          { id }
        );
      }

      try {
        const result = await client.executeQuery<TResult>(query, context, {
          userID: userID ?? '',
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
  }) as ToolAction<TSchema, typeof outputSchema, TExecutionContext>;

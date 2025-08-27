import { createTool, ToolAction, ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import {
  GraphQLClient,
  GraphQLClientError,
} from '../../../utils/graphql/client';
import logger from '../../../utils/logger';
import { USER_ID } from '../../agents/constants';

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
      const userId = runtimeContext.get(USER_ID) as string | undefined;
      if (!userId) {
        throw new Error(
          'User ID not available in RuntimeContext unable to execute query'
        );
      }

      try {
        const result = await client.executeQuery<TResult>(query, context, {
          userID: userId,
        });
        return result;
      } catch (error) {
        const baseError = {
          id,
          context,
          userID: userId,
          error: error instanceof Error ? error.message : String(error),
        };

        if (error instanceof GraphQLClientError) {
          logger.error('GraphQLClientError during tool execution', {
            ...baseError,
            statusCode: error.statusCode,
            graphqlErrors: error.errors,
          });

          throw error;
        }

        logger.error(
          'Unexpected error during GraphQL tool execution',
          baseError
        );

        throw error;
      }
    },
  }) as ToolAction<TSchema, typeof outputSchema, TExecutionContext>;

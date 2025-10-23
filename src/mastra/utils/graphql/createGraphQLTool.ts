import { createTool, Tool, ToolExecutionContext } from '@mastra/core';
import { DocumentNode } from 'graphql';
import { z } from 'zod';
import { USER_ID } from '@/mastra/agents/constants';
import { GraphQLClient, GraphQLClientError } from '@/utils/graphql/client';
import logger from '@/utils/logger';

interface GraphQLToolInputParams<
  GraphQLQuery extends object,
  GraphQLQueryVariables extends object,
> {
  id: string;
  description: string;
  query: string | DocumentNode;
  inputSchema: z.ZodType<GraphQLQueryVariables>;
  outputSchema: z.ZodType<GraphQLQuery>;
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
 * @param param0.outputSchema - Optional output schema for workflow compatibility
 * @returns A typed Mastra tool that can be used in both agents and workflows
 */
export const createGraphQLTool = <
  GraphQLQuery extends object,
  GraphQLQueryVariables extends object,
  TSuspendSchema extends z.ZodType = z.ZodType<unknown>,
  TResumeSchema extends z.ZodType = z.ZodType<unknown>,
>({
  client,
  description,
  id,
  inputSchema,
  outputSchema,
  query,
}: GraphQLToolInputParams<GraphQLQuery, GraphQLQueryVariables>): Tool<
  z.ZodType<GraphQLQueryVariables>,
  z.ZodType<GraphQLQuery>,
  TSuspendSchema,
  TResumeSchema,
  ToolExecutionContext<z.ZodType<GraphQLQueryVariables>>
> & {
  inputSchema: z.ZodType<GraphQLQueryVariables>;
  outputSchema: z.ZodType<GraphQLQuery>;
  execute: (
    context: ToolExecutionContext<z.ZodType<GraphQLQueryVariables>>
  ) => Promise<GraphQLQuery>;
} =>
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
        const result = await client.executeQuery<GraphQLQuery>(query, context, {
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
  });

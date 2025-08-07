import { createTool } from '@mastra/core';
import { z } from 'zod';
import { TaskHistoryQuery } from '../../../gql/generated/types';
import logger from '../../../utils/logger';
import { CursorParamsSchema } from '../evergreen/getTaskHistory';
import evergreenClient from '../evergreen/graphql/evergreenClient';
import GET_TASK_HISTORY from '../evergreen/graphql/get-task-history';

const TaskHistoryOptsSchema = z.object({
  buildVariant: z.string(),
  cursorParams: CursorParamsSchema,
  date: z.union([z.string().datetime(), z.date()]).optional(),
  limit: z.number().optional(),
  projectIdentifier: z.string(),
  taskName: z.string(),
});

/**
 * This is an adapter tool that wraps around getTaskHistoryTool
 * to make it easier to use in workflows
 */
const taskHistoryToolAdapter = createTool({
  id: 'taskHistoryToolAdapter',
  description:
    'Adapter tool for getting Evergreen task history information to use in workflows',
  inputSchema: TaskHistoryOptsSchema,
  execute: async ({ context, runtimeContext }) => {
    try {
      const userID = runtimeContext.get('userID') as string | undefined;
      if (!userID) {
        logger.warn(
          'User ID not available in RuntimeContext provided to taskHistoryToolAdapter'
        );
      }

      // The GraphQL query expects the parameters wrapped in an "options" object
      const variables = {
        options: context,
      };

      // Execute the GraphQL query directly with properly formatted variables
      const result = await evergreenClient.executeQuery<TaskHistoryQuery>(
        GET_TASK_HISTORY,
        variables,
        {
          userID: userID ?? '',
        }
      );

      return result;
    } catch (error) {
      logger.error('Error executing taskHistoryToolAdapter:', error);

      if (error instanceof Error) {
        const errorMessage = error.message;
        // Check if it's a GraphQL error with additional details
        if ('errors' in error && 'statusCode' in error) {
          return {
            error: errorMessage,
            graphqlErrors: (error as any).errors,
            statusCode: (error as any).statusCode,
          };
        }
        return {
          error: errorMessage,
        };
      }

      return {
        error: String(error),
      };
    }
  },
});

export default taskHistoryToolAdapter;

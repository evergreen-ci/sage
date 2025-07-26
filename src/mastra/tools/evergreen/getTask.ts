import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { loadGraphQLFile } from '../../../utils/graphql/utils';
import { createGraphQLTool } from '../utils/createGraphQLTool';

const GET_TASK = loadGraphQLFile('gql/queries/get-task.graphql');

const inputSchema = z.object({
  taskID: z.string(),
  execution: z.number().optional().nullable(),
});

export const getTask = createGraphQLTool<
  typeof inputSchema,
  ToolExecutionContext<typeof inputSchema>
>({
  query: GET_TASK,
  id: 'Get Task Information',
  description: `Fetches the current task information for a given taskID, If no execution is provided, the latest execution will be used. Do not make up an execution number.`,
  inputSchema,
});

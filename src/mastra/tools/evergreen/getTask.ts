import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { GetTaskQuery } from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';
import GET_TASK from './graphql/get-task';

const getTaskInputSchema = z.object({
  taskID: z.string(),
  execution: z.number().optional(),
});

const getTaskTool = createGraphQLTool<
  typeof getTaskInputSchema,
  GetTaskQuery,
  ToolExecutionContext<typeof getTaskInputSchema>
>({
  id: 'getTask',
  description: 'Get a task from Evergreen',
  query: GET_TASK,
  inputSchema: getTaskInputSchema,
  client: evergreenClient,
});

export default getTaskTool;

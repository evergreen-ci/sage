import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { GetTaskQuery } from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';
import GET_TASK from './graphql/get-task';

const getTaskInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

const getTaskTool = createGraphQLTool<
  typeof getTaskInputSchema,
  GetTaskQuery,
  ToolExecutionContext<typeof getTaskInputSchema>
>({
  id: 'getTask',
  description:
    'Get a task from Evergreen. This tool is used to get the details of a task from Evergreen. It is used to get the details of a task from Evergreen. It requires a taskId to be provided. A taskId is a string that is unique to a task in Evergreen',
  query: GET_TASK,
  inputSchema: getTaskInputSchema,
  client: evergreenClient,
});

export default getTaskTool;

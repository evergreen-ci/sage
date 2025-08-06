import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { TaskFilesQuery } from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';
import GET_TASK_FILES from './graphql/get-task-files';

const getTaskInputSchema = z.object({
  taskID: z.string(),
  execution: z.number().optional(),
});

const getTaskFilesTool = createGraphQLTool<
  typeof getTaskInputSchema,
  TaskFilesQuery,
  ToolExecutionContext<typeof getTaskInputSchema>
>({
  id: 'getTaskFiles',
  description:
    'Get the files of a task from Evergreen. This tool is used to get files for a task from Evergreen. It requires a taskID to be provided. A taskID is a string that is unique to a task in Evergreen',
  query: GET_TASK_FILES,
  inputSchema: getTaskInputSchema,
  client: evergreenClient,
});

export default getTaskFilesTool;

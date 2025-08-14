import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { TaskHistoryQuery } from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';
import GET_TASK_HISTORY from './graphql/get-task-history';

const TaskHistoryDirectionEnum = z.enum(['AFTER', 'BEFORE']);

export const CursorParamsSchema = z.object({
  cursorId: z.string(),
  direction: TaskHistoryDirectionEnum,
  includeCursor: z.boolean(),
});

const TaskHistoryOptsSchema = z.object({
  options: z.object({
    buildVariant: z.string(),
    cursorParams: CursorParamsSchema,
    date: z.union([z.string().datetime(), z.date()]).optional(), // Accepts ISO string or Date
    limit: z.number().optional(),
    projectIdentifier: z.string(),
    taskName: z.string(),
  }),
});

const getTaskHistoryTool = createGraphQLTool<
  typeof TaskHistoryOptsSchema,
  TaskHistoryQuery,
  ToolExecutionContext<typeof TaskHistoryOptsSchema>
>({
  id: 'getTaskHistory',
  description:
    'Get the history of a task from Evergreen. This tool is used to get the details of a task history and its historical statuses from prior executions from Evergreen. It requires TaskHistoryOpts as input.',
  query: GET_TASK_HISTORY,
  inputSchema: TaskHistoryOptsSchema,
  client: evergreenClient,
  transformVariables: context => ({ options: context }),
});

export default getTaskHistoryTool;

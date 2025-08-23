import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { TaskHistoryQuery } from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';

const GET_TASK_HISTORY = `query TaskHistory($options: TaskHistoryOpts!) {
  taskHistory(options: $options) {
    pagination {
      mostRecentTaskOrder
      oldestTaskOrder
    }
    tasks {
      id
      activated
      canRestart
      canSchedule
      createTime
      displayStatus
      execution
      latestExecution
      order
      revision
      tests(opts: { statuses: ["fail", "silentfail"] }) {
        testResults {
          id
          logs {
            urlParsley
          }
          status
          testFile
        }
      }
      versionMetadata {
        id
        author
        message
      }
    }
  }
}
`;

const TaskHistoryOptsSchema = z.object({
  options: z.object({
    buildVariant: z.string(),
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
});

export default getTaskHistoryTool;

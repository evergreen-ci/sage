import { gql } from 'graphql-tag';
import { z } from 'zod';
import {
  TaskHistoryQuery,
  TaskHistoryQueryVariables,
  TaskHistoryDirection,
} from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';

const GET_TASK_HISTORY = gql`
  query TaskHistory($options: TaskHistoryOpts!) {
    taskHistory(options: $options) {
      pagination {
        mostRecentTaskOrder
        oldestTaskOrder
      }
      tasks {
        id
        activated
        createTime
        displayStatus
        displayName
        execution
        order
        revision
        tests(opts: { statuses: ["fail", "silentfail"] }) {
          testResults {
            id
            logs {
              urlParsley
              urlRaw
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

const getTaskHistoryInputSchema = z.object({
  options: z.object({
    buildVariant: z.string(),
    date: z.date().optional(), // Accepts ISO string or Date
    limit: z.number().optional(),
    projectIdentifier: z.string(),
    taskName: z.string(),
    cursorParams: z.object({
      cursorId: z.string(),
      direction: z.nativeEnum(TaskHistoryDirection),
      includeCursor: z.boolean(),
    }),
  }),
});

const getTaskHistoryOutputSchema = z.object({
  taskHistory: z.object({
    pagination: z.object({
      mostRecentTaskOrder: z.number(),
      oldestTaskOrder: z.number(),
    }),
    tasks: z.array(
      z.object({
        id: z.string(),
        activated: z.boolean(),
        displayName: z.string(),
        displayStatus: z.string(),
        order: z.number(),
        execution: z.number(),
        patchNumber: z.number().optional().nullable(),
        buildVariant: z.string(),
        projectIdentifier: z.string().optional().nullable(),
        versionMetadata: z.object({
          id: z.string(),
          message: z.string(),
          author: z.string(),
        }),
        tests: z.object({
          testResults: z.array(
            z.object({
              id: z.string(),
              status: z.string(),
              testFile: z.string(),
              logs: z.object({
                urlParsley: z.string(),
                urlRaw: z.string(),
              }),
            })
          ),
        }),
        details: z
          .object({
            description: z.string().optional(),
            failingCommand: z.string().optional().nullable(),
            status: z.string(),
          })
          .optional()
          .nullable(),
      })
    ),
  }),
});

const getTaskHistoryTool = createGraphQLTool<
  TaskHistoryQuery,
  TaskHistoryQueryVariables
>({
  id: 'getTaskHistory',
  description:
    'Get the history of a task from Evergreen. This tool is used to get the details of a task history and its historical statuses from prior executions from Evergreen. It requires TaskHistoryOpts as input.',
  query: GET_TASK_HISTORY,
  inputSchema: getTaskHistoryInputSchema,
  outputSchema: getTaskHistoryOutputSchema,
  client: evergreenClient,
});

export default getTaskHistoryTool;

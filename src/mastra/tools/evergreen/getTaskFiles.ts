import { gql } from 'graphql-tag';
import { z } from 'zod';
import {
  TaskFilesQuery,
  TaskFilesQueryVariables,
} from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import { wrapToolWithTracing } from '../../utils/tracing/wrapWithTracing';
import evergreenClient from './graphql/evergreenClient';

const GET_TASK_FILES = gql`
  query TaskFiles($taskId: String!, $execution: Int) {
    task(taskId: $taskId, execution: $execution) {
      id
      execution
      files {
        fileCount
        groupedFiles {
          files {
            link
            name
            urlParsley
          }
          taskName
        }
      }
    }
  }
`;

const getTaskInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
});

const getTaskOutputSchema = z.object({
  task: z.object({
    id: z.string(),
    execution: z.number(),
    files: z.object({
      fileCount: z.number(),
      groupedFiles: z.array(
        z.object({
          files: z.array(
            z.object({
              link: z.string(),
              name: z.string(),
              urlParsley: z.string(),
            })
          ),
          taskName: z.string(),
        })
      ),
    }),
  }),
});

const getTaskFilesTool = wrapToolWithTracing(
  createGraphQLTool<TaskFilesQuery, TaskFilesQueryVariables>({
    id: 'getTaskFiles',
    description:
      'Get the files of a task from Evergreen. This tool is used to get files for a task from Evergreen. It requires a taskId to be provided. A taskId is a string that is unique to a task in Evergreen',
    query: GET_TASK_FILES,
    inputSchema: getTaskInputSchema,
    outputSchema: getTaskOutputSchema,
    client: evergreenClient,
  })
);

export default getTaskFilesTool;

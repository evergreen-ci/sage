import { z } from 'zod';
import { TaskFilesQuery } from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';

const GET_TASK_FILES = `query TaskFiles($taskId: String!, $execution: Int) {
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

const getTaskFilesTool = createGraphQLTool<
  typeof getTaskInputSchema,
  TaskFilesQuery
>({
  id: 'getTaskFiles',
  description:
    'Get the files of a task from Evergreen. This tool is used to get files for a task from Evergreen. It requires a taskId to be provided. A taskId is a string that is unique to a task in Evergreen',
  query: GET_TASK_FILES,
  inputSchema: getTaskInputSchema,
  client: evergreenClient,
});

export default getTaskFilesTool;

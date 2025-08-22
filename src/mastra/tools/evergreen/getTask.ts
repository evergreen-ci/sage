import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { GetTaskQuery } from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';

const GET_TASK = `query GetTask($taskId: String!, $execution: Int) {
  task(taskId: $taskId, execution: $execution) {
    id
    displayName
    displayStatus
    execution
    patchNumber
    buildVariant
    projectIdentifier
    versionMetadata {
      id
      isPatch
      message
      projectIdentifier
      projectMetadata {
        id
      }
      revision
    }
    details {
      description
      failingCommand
      status
    }
  }
}
`;

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

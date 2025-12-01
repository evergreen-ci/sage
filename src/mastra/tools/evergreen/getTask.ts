import { gql } from 'graphql-tag';
import { z } from 'zod';
import { createGraphQLTool } from '@/mastra/utils/graphql/createGraphQLTool';
import {
  GetTaskQuery,
  GetTaskQueryVariables,
} from '../../../gql/generated/types';
import evergreenClient from './graphql/evergreenClient';

const GET_TASK = gql`
  query GetTask($taskId: String!, $execution: Int) {
    task(taskId: $taskId, execution: $execution) {
      id
      displayName
      displayStatus
      execution
      patchNumber
      buildVariant
      projectIdentifier
      requester
      distroId
      imageId
      baseTask {
        id
      }
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

const getTaskOutputSchema = z.object({
  task: z.object({
    id: z.string(),
    displayName: z.string(),
    displayStatus: z.string(),
    execution: z.number(),
    patchNumber: z.number().optional().nullable(),
    buildVariant: z.string(),
    projectIdentifier: z.string().optional().nullable(),
    requester: z.string(),
    distroId: z.string(),
    imageId: z.string().optional().nullable(),
    baseTask: z
      .object({
        id: z.string(),
      })
      .optional()
      .nullable(),
    versionMetadata: z.object({
      id: z.string(),
      isPatch: z.boolean(),
      message: z.string(),
      projectIdentifier: z.string(),
      revision: z.string(),
      projectMetadata: z
        .object({
          id: z.string(),
        })
        .optional(),
    }),
    details: z
      .object({
        description: z.string().optional(),
        failingCommand: z.string().optional().nullable(),
        status: z.string(),
      })
      .optional()
      .nullable(),
  }),
});

const getTaskTool = createGraphQLTool<GetTaskQuery, GetTaskQueryVariables>({
  id: 'getTask',
  description:
    'Get a task from Evergreen. This tool is used to get the details of a task from Evergreen. It is used to get the details of a task from Evergreen. It requires a taskId to be provided. A taskId is a string that is unique to a task in Evergreen',
  query: GET_TASK,
  inputSchema: getTaskInputSchema,
  outputSchema: getTaskOutputSchema,
  client: evergreenClient,
});

export default getTaskTool;

import { gql } from 'graphql-tag';
import { z } from 'zod';
import {
  VersionQuery,
  VersionQueryVariables,
} from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';

const GET_VERSION = gql`
  query Version($id: String!, $includeNeverActivatedTasks: Boolean) {
    version(versionId: $id) {
      id
      activated
      author
      baseVersion {
        id
      }
      createTime
      finishTime
      isPatch
      message
      order
      patch {
        id
        alias
        patchNumber
      }
      previousVersion {
        id
        revision
      }
      project
      projectIdentifier
      requester
      revision
      startTime
      status
      taskCount(
        options: { includeNeverActivatedTasks: $includeNeverActivatedTasks }
      )
    }
  }
`;

const getVersionInputSchema = z.object({
  id: z.string(),
  includeNeverActivatedTasks: z.boolean().optional(),
});

const getVersionOutputSchema = z.object({
  version: z.object({
    id: z.string(),
    activated: z.boolean(),
    author: z.string(),
    createTime: z.date(),
    finishTime: z.date().optional(),
    isPatch: z.boolean(),
    message: z.string(),
    order: z.number(),
    project: z.string(),
    projectIdentifier: z.string(),
    repo: z.string(),
    requester: z.string(),
    revision: z.string(),
    startTime: z.date().optional(),
    status: z.string(),
    taskCount: z.number().optional(),
    baseVersion: z.object({
      id: z.string(),
    }),
    patch: z.object({
      id: z.string(),
      alias: z.string(),
      patchNumber: z.number(),
    }),
  }),
});
const getVersionTool = createGraphQLTool<VersionQuery, VersionQueryVariables>({
  id: 'getVersion',
  description:
    'Get a version from Evergreen. This tool is used to get the details of a version from Evergreen. It requires an id (versionId) and can optionally include never activated tasks.',
  query: GET_VERSION,
  inputSchema: getVersionInputSchema,
  outputSchema: getVersionOutputSchema,
  client: evergreenClient,
});

export default getVersionTool;

import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { VersionQuery } from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';

const GET_VERSION = `query Version($id: String!, $includeNeverActivatedTasks: Boolean) {
  version(versionId: $id) {
    id
    activated
    author
    authorEmail
    baseVersion {
      id
    }
    createTime
    errors
    externalLinksForMetadata {
      displayName
      url
    }
    finishTime
    gitTags {
      pusher
      tag
    }
    ignored
    isPatch
    manifest {
      id
      branch
      isBase
      moduleOverrides
      modules
      project
      revision
    }
    message
    order
    parameters {
      key
      value
    }
    patch {
      id
      alias
      childPatches {
        id
        githash
        parameters {
          key
          value
        }
        projectIdentifier
        status
        versionFull {
          id
          baseVersion {
            id
          }
          status
        }
      }
      githubPatchData {
        headHash
        prNumber
      }
      patchNumber
    }
    previousVersion {
      id
      revision
    }
    project
    projectIdentifier
    projectMetadata {
      id
      branch
      owner
      repo
    }
    repo
    requester
    revision
    startTime
    status
    taskCount(
      options: { includeNeverActivatedTasks: $includeNeverActivatedTasks }
    )
    versionTiming {
      makespan
      timeTaken
    }
    warnings
  }
}
`;

const getVersionInputSchema = z.object({
  id: z.string(),
  includeNeverActivatedTasks: z.boolean().optional(),
});

const getVersionTool = createGraphQLTool<
  typeof getVersionInputSchema,
  VersionQuery,
  ToolExecutionContext<typeof getVersionInputSchema>
>({
  id: 'getVersion',
  description:
    'Get a version from Evergreen. This tool is used to get the details of a version from Evergreen. It requires an id (versionId) and can optionally include never activated tasks.',
  query: GET_VERSION,
  inputSchema: getVersionInputSchema,
  client: evergreenClient,
});

export default getVersionTool;

import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { VersionQuery } from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';
import GET_VERSION from './graphql/get-version';

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

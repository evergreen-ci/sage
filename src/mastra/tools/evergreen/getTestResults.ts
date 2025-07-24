import { z } from 'zod';
import {
  createGraphQLTool,
  loadGraphQLFile,
} from '../../../utils/graphql/utils';

const GET_TEST_RESULTS = loadGraphQLFile(
  'gql/queries/get-test-results.graphql'
);

export const getTestResults = createGraphQLTool({
  query: GET_TEST_RESULTS,
  id: 'Get Test Results',
  description: `Fetches the test results for a given taskID`,
  inputSchema: z.object({
    taskID: z.string(),
    execution: z.number().optional().default(0),
    pageNum: z.number().optional().default(0),
    limitNum: z.number().optional().default(50),
    statusList: z.array(z.string()).optional().default(['fail']),
    testName: z.string().optional().default(''),
  }),
});

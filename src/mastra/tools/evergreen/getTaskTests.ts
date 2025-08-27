import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import { TaskTestsQuery } from '../../../gql/generated/types';
import { createGraphQLTool } from '../../utils/graphql/createGraphQLTool';
import evergreenClient from './graphql/evergreenClient';

const GET_TASK_TESTS = `query TaskTests(
  $id: String!
  $execution: Int
  $pageNum: Int
  $limitNum: Int
  $statusList: [String!]!
  $sort: [TestSortOptions!]
  $testName: String!
) {
  task(taskId: $id, execution: $execution) {
    id
    execution
    tests(
      opts: {
        sort: $sort
        page: $pageNum
        limit: $limitNum
        statuses: $statusList
        testName: $testName
      }
    ) {
      filteredTestCount
      testResults {
        id
        baseStatus
        duration
        logs {
          url
          urlParsley
          urlRaw
        }
        status
        testFile
      }
      totalTestCount
    }
  }
}
`;

const TestSortCategoryEnum = z.enum([
  'BASE_STATUS',
  'DURATION',
  'START_TIME',
  'STATUS',
  'TEST_NAME',
]);
const SortDirectionEnum = z.enum(['ASC', 'DESC']);
const TestSortOptionsSchema = z.object({
  direction: SortDirectionEnum,
  sortBy: TestSortCategoryEnum,
});

const StatusEnum = z.enum(['fail', 'pass']);

const getTaskTestsInputSchema = z.object({
  id: z.string(),
  execution: z.number().optional(),
  pageNum: z.number().optional(),
  limitNum: z.number().optional(),
  statusList: z.array(StatusEnum),
  sort: z.array(TestSortOptionsSchema).optional(),
  testName: z.string(),
});

const getTaskTestsTool = createGraphQLTool<
  typeof getTaskTestsInputSchema,
  TaskTestsQuery,
  ToolExecutionContext<typeof getTaskTestsInputSchema>
>({
  id: 'getTaskTests',
  description:
    'Get task test results from Evergreen. This tool is used to get the test results for a task. It requires an id (taskId), statusList, and testName. Other options are optional.',
  query: GET_TASK_TESTS,
  inputSchema: getTaskTestsInputSchema,
  client: evergreenClient,
});

export default getTaskTestsTool;

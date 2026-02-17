import { gql } from 'graphql-tag';
import { z } from 'zod';
import { createGraphQLTool } from '@/mastra/utils/graphql/createGraphQLTool';
import {
  TaskTestsQuery,
  TaskTestsQueryVariables,
  SortDirection,
  TestSortCategory,
} from '../../../gql/generated/types';
import evergreenClient from './graphql/evergreenClient';

const GET_TASK_TESTS = gql`
  query TaskTests(
    $id: String!
    $execution: Int
    $pageNum: Int
    $limitNum: Int
    $statusList: [String!]
    $sort: [TestSortOptions!]
    $groupId: String
    $testName: String
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
          groupID: $groupId
          testName: $testName
        }
      ) {
        filteredTestCount
        testResults {
          id
          baseStatus
          duration
          logs {
            urlParsley
            urlRaw
          }
          status
          testName: testFile
        }
        totalTestCount
      }
    }
  }
`;

const TestSortOptionsSchema = z.object({
  direction: z.enum(SortDirection),
  sortBy: z.enum(TestSortCategory),
});

const StatusEnum = z.enum(['fail', 'pass', 'timeout', 'silentfail']);

const getTaskTestsInputSchema = z.object({
  id: z.string(),
  execution: z.number().optional(),
  pageNum: z.number().optional(),
  limitNum: z.number().optional(),
  statusList: z.array(StatusEnum).default([]).optional(),
  groupId: z.string().optional(),
  sort: z.array(TestSortOptionsSchema).optional(),
  testName: z.string().optional(),
});

export const getTaskTestsOutputSchema = z.object({
  task: z.object({
    id: z.string(),
    execution: z.number(),
    tests: z.object({
      filteredTestCount: z.number(),
      totalTestCount: z.number(),
      testResults: z.array(
        z.object({
          id: z.string(),
          baseStatus: z.string().nullable(),
          duration: z.number().optional(),
          status: z.string(),
          testName: z.string(),
          logs: z.object({
            urlParsley: z.string().optional(),
            urlRaw: z.string().optional(),
          }),
        })
      ),
    }),
  }),
});
const getTaskTestsTool = createGraphQLTool<
  TaskTestsQuery,
  TaskTestsQueryVariables
>({
  id: 'getTaskTests',
  description:
    'Get task test results from Evergreen. This tool is used to get the test results for a task. It requires an id (taskId), statusList, and testName. Other options are optional.',
  query: GET_TASK_TESTS,
  inputSchema: getTaskTestsInputSchema,
  outputSchema: getTaskTestsOutputSchema,
  client: evergreenClient,
});

export default getTaskTestsTool;

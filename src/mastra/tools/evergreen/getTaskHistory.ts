import { ToolExecutionContext } from '@mastra/core';
import { z } from 'zod';
import {
  createGraphQLTool,
  loadGraphQLFile,
} from '../../../utils/graphql/utils';

const GET_TASK_HISTORY = loadGraphQLFile(
  'gql/queries/get-task-history.graphql'
);

const inputSchema = z.object({
  projectIdentifier: z.string(),
  taskName: z.string(),
  buildVariant: z.string(),
  cursorParams: z.object({
    cursorId: z.string(),
    direction: z.enum(['AFTER', 'BEFORE']),
    includeCursor: z.boolean(),
  }),
  limit: z.number().optional().default(50),
});

export const getTaskHistory = createGraphQLTool<
  typeof inputSchema,
  ToolExecutionContext<typeof inputSchema>
>({
  query: GET_TASK_HISTORY,
  id: 'Get Task History',
  description: `
Retrieves the task history for a given \`projectIdentifier\`, \`taskName\`, and \`buildVariant\`.

If any of these fields are missing, you must first retrieve them using the \`getTask\` tool. These values can be found in the task details.

Supports pagination via the \`cursorParams\` object:

* \`cursorId\`: ID of the task to paginate from.
* \`direction\`: \`'AFTER'\` or \`'BEFORE'\`, indicating the direction of pagination.
* \`includeCursor\`: Whether to include the cursor task in the results.

The optional \`limit\` parameter controls the number of tasks to return (default: 50).
`,
  inputSchema,
});

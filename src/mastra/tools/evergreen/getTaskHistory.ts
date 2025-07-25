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
  description: `Retrieves the task history for a specified project, task name, and build variant.
  If you do not have access to the below fields, You must first request them from the getTask tool.
  The projectIdentifier is the identifier of the project to get the task history for.
  The taskName is the name of the task to get the history for.
  The buildVariant is the build variant to get the history for.

  These above can be found in the task details.
Supports pagination via the \`cursorParams\` object:
- \`cursorId\`: ID of the task to paginate from.
- \`direction\`: 'AFTER' or 'BEFORE' to determine pagination direction.
- \`includeCursor\`: Whether to include the cursor task in the results.

The \`limit\` parameter sets the maximum number of tasks to return (default: 50).`,
  inputSchema,
});

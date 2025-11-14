import { createTool } from '@mastra/core';
import { z } from 'zod';
import { TaskHistoryDirection } from '@/gql/generated/types';
import getTaskTool from './getTask';
import getTaskHistoryTool from './getTaskHistory';

enum Requester {
  AdHoc = 'ad_hoc',
  GitHubMergeQueue = 'github_merge_request',
  GitHubPR = 'github_pull_request',
  GitTag = 'git_tag_request',
  Gitter = 'gitter_request',
  Patch = 'patch_request',
  Trigger = 'trigger_request',
}

const waterfallRequesters = [
  Requester.AdHoc,
  Requester.GitTag,
  Requester.Gitter,
  Requester.Trigger,
];

/**
 * Check if a task or version requester is a waterfall commit requester
 * @param requester - The requester to check
 * @returns true if the requester is a waterfall commit requester, false otherwise
 */
const isWaterfallRequester = (requester: Requester) =>
  waterfallRequesters.includes(requester);

const getTaskHistoryByIdInputSchema = z.object({
  taskId: z.string(),
  execution: z.number().optional(),
  limit: z.number().optional().default(30),
});

const getTaskHistoryByIdOutputSchema = z.object({
  history: getTaskHistoryTool.outputSchema,
});

const getTaskHistoryByIdTool = createTool({
  id: 'getTaskHistoryById',
  description:
    'Get the execution history of a task from Evergreen using its task ID. This tool fetches task details internally to determine the correct parameters, then retrieves and returns only the historical execution data for that task. It requires a taskId and optionally an execution number and limit.',
  inputSchema: getTaskHistoryByIdInputSchema,
  outputSchema: getTaskHistoryByIdOutputSchema,
  execute: async ({ context, runtimeContext, tracingContext }) => {
    const { execution, limit, taskId } = context;

    // Step 1: Fetch task data
    const taskResult = await getTaskTool.execute({
      context: { taskId, execution },
      runtimeContext,
      tracingContext,
    });

    const { task } = taskResult;
    if (!task) {
      throw new Error('Previous get-task step did not return a task');
    }

    // Step 2: Extract and validate required fields
    const {
      baseTask,
      buildVariant,
      displayName,
      projectIdentifier,
      requester,
    } = task;

    if (!displayName || !buildVariant || !projectIdentifier || !requester) {
      throw new Error(
        `Cannot fetch history: missing required fields (displayName: ${displayName}, buildVariant: ${buildVariant}, projectIdentifier: ${projectIdentifier}, requester: ${requester})`
      );
    }

    // Step 3: Calculate cursor ID based on requester type
    let cursorId = taskId;
    if (!isWaterfallRequester(requester as Requester)) {
      if (!baseTask) {
        throw new Error('Base task not found for non-waterfall requester');
      }
      cursorId = baseTask.id;
    }

    const cursorParams = {
      cursorId,
      direction: TaskHistoryDirection.Before,
      includeCursor: true,
    };

    // Step 4: Fetch task history
    const historyResult = await getTaskHistoryTool.execute({
      context: {
        options: {
          taskName: displayName,
          buildVariant,
          projectIdentifier,
          cursorParams,
          limit,
        },
      },
      tracingContext,
      runtimeContext,
    });

    return {
      history: historyResult,
    };
  },
});

export default getTaskHistoryByIdTool;

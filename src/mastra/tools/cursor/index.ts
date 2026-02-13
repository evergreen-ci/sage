import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { USER_EMAIL } from '@/mastra/agents/constants';
import {
  launchCursorAgent,
  getAgentStatus,
} from '@/services/cursor/cursorAgentService';

const launchCursorAgentInputSchema = z.object({
  targetRepository: z
    .string()
    .describe(
      'The GitHub repository URL or org/repo format (e.g. "10gen/mongo" or "https://github.com/10gen/mongo")'
    ),
  targetRef: z
    .string()
    .optional()
    .describe(
      'Optional branch/ref to use. If not provided, the repo default branch is used'
    ),
  summary: z.string().describe('A short summary of the work to be done'),
  description: z
    .string()
    .optional()
    .describe('A detailed description of the work to be done'),
  ticketKey: z
    .string()
    .describe('The Jira ticket key associated with this work (e.g. EVG-1234)'),
  autoCreatePr: z
    .boolean()
    .optional()
    .describe(
      'Whether to automatically create a PR when the agent finishes. Defaults to false'
    ),
});

const launchCursorAgentOutputSchema = z.object({
  success: z.boolean(),
  agentId: z.string().optional(),
  agentUrl: z.string().optional(),
  error: z.string().optional(),
});

export const launchCursorAgentTool = createTool({
  id: 'launchCursorAgentTool',
  description:
    'Launches a Cursor Cloud Agent to implement code changes for a Jira ticket. The agent will clone the repository, implement the changes described in the summary/description, and optionally create a PR.',
  inputSchema: launchCursorAgentInputSchema,
  outputSchema: launchCursorAgentOutputSchema,
  execute: async (inputData, context) => {
    const { requestContext } = context || {};
    const assigneeEmail = requestContext?.get(USER_EMAIL) as string | undefined;

    if (!assigneeEmail) {
      return {
        success: false,
        error: 'No authenticated user found in request context',
      };
    }

    return launchCursorAgent({
      ...inputData,
      description: inputData.description ?? null,
      assigneeEmail,
    });
  },
});

const getCursorAgentStatusInputSchema = z.object({
  agentId: z
    .string()
    .describe('The ID of the Cursor Cloud Agent to check status for'),
});

const getCursorAgentStatusOutputSchema = z.object({
  success: z.boolean(),
  status: z
    .enum(['RUNNING', 'FINISHED', 'ERROR', 'CREATING', 'EXPIRED'])
    .optional(),
  prUrl: z.string().optional(),
  summary: z.string().optional(),
  agentUrl: z.string().optional(),
  error: z.string().optional(),
});

export const getCursorAgentStatusTool = createTool({
  id: 'getCursorAgentStatusTool',
  description:
    'Gets the current status of a previously launched Cursor Cloud Agent. Returns the agent status, PR URL (if created), and a summary of the work done.',
  inputSchema: getCursorAgentStatusInputSchema,
  outputSchema: getCursorAgentStatusOutputSchema,
  execute: async (inputData, context) => {
    const { requestContext } = context || {};
    const assigneeEmail = requestContext?.get(USER_EMAIL) as string | undefined;

    if (!assigneeEmail) {
      return {
        success: false,
        error: 'No authenticated user found in request context',
      };
    }

    return getAgentStatus({
      agentId: inputData.agentId,
      assigneeEmail,
    });
  },
});

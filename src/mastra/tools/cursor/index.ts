import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { USER_EMAIL } from '@/mastra/agents/constants';
import {
  addFollowupToAgent,
  getAgentConversation,
  getAgentStatus,
  launchCursorAgent,
  launchResearcherAgent,
  waitForAgentCompletion,
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

const cursorResearcherInputSchema = z.object({
  agentId: z
    .string()
    .optional()
    .describe(
      'ID of an existing Cursor researcher agent to send a follow-up to. If omitted, a new agent is launched.'
    ),
  targetRepository: z
    .string()
    .optional()
    .describe(
      'Required when launching a new agent. The GitHub repository URL or org/repo format (e.g. "10gen/mongo" or "https://github.com/10gen/mongo")'
    ),
  targetRef: z
    .string()
    .optional()
    .describe(
      'Optional branch/ref to use. If not provided, the repo default branch is used'
    ),
  prompt: z
    .string()
    .describe(
      'The research question or follow-up prompt to investigate in the codebase'
    ),
});

const cursorResearcherOutputSchema = z.object({
  success: z.boolean(),
  answer: z.string().optional(),
  agentId: z.string().optional(),
  agentUrl: z.string().optional(),
  error: z.string().optional(),
});

// Shared helper to wait for completion, retrieve conversation, and extract the answer.
const getResearchAnswer = async (
  agentId: string,
  userEmail: string,
  agentUrl?: string
): Promise<z.infer<typeof cursorResearcherOutputSchema>> => {
  const completionResult = await waitForAgentCompletion({
    agentId,
    assigneeEmail: userEmail,
  });

  if (!completionResult.success) {
    return {
      success: false,
      agentId,
      agentUrl: agentUrl ?? completionResult.agentUrl,
      error: completionResult.error,
    };
  }

  if (completionResult.status !== 'FINISHED') {
    return {
      success: false,
      agentId,
      agentUrl: agentUrl ?? completionResult.agentUrl,
      error: `Agent ended with status: ${completionResult.status}`,
    };
  }

  const conversationResult = await getAgentConversation({
    agentId,
    userEmail,
  });

  if (!conversationResult.success || !conversationResult.messages) {
    return {
      success: false,
      agentId,
      agentUrl: agentUrl ?? completionResult.agentUrl,
      error:
        conversationResult.error ?? 'Failed to retrieve agent conversation',
    };
  }

  const lastAssistantMessage = [...conversationResult.messages]
    .reverse()
    .find(m => m.type === 'assistant_message');

  const answer =
    lastAssistantMessage?.text ??
    completionResult.summary ??
    'Agent completed but produced no answer.';

  return {
    success: true,
    answer,
    agentId,
    agentUrl: agentUrl ?? completionResult.agentUrl,
  };
};

export const cursorResearcherTool = createTool({
  id: 'cursorResearcherTool',
  description:
    'Researches a codebase using a Cursor Cloud Agent and answers a question. Can either launch a new agent or send a follow-up to an existing one. The agent explores the repository without making changes or creating PRs. Polls until the agent completes, then returns the answer along with the agentId for future follow-ups.',
  inputSchema: cursorResearcherInputSchema,
  outputSchema: cursorResearcherOutputSchema,
  execute: async (inputData, context) => {
    const { requestContext } = context || {};
    const userEmail = requestContext?.get(USER_EMAIL) as string | undefined;

    if (!userEmail) {
      return {
        success: false,
        error: 'No authenticated user found in request context',
      };
    }

    // Follow-up mode: send a follow-up to an existing agent
    if (inputData.agentId) {
      const followupResult = await addFollowupToAgent({
        agentId: inputData.agentId,
        text: inputData.prompt,
        userEmail,
      });

      if (!followupResult.success) {
        return {
          success: false,
          agentId: inputData.agentId,
          error: followupResult.error,
        };
      }

      return getResearchAnswer(inputData.agentId, userEmail);
    }

    // New agent mode: launch a fresh researcher agent
    if (!inputData.targetRepository) {
      return {
        success: false,
        error:
          'targetRepository is required when launching a new researcher agent (no agentId provided)',
      };
    }

    const launchResult = await launchResearcherAgent({
      targetRepository: inputData.targetRepository,
      targetRef: inputData.targetRef,
      prompt: inputData.prompt,
      userEmail,
    });

    if (!launchResult.success || !launchResult.agentId) {
      return {
        success: false,
        agentUrl: launchResult.agentUrl,
        error: launchResult.error ?? 'Failed to launch researcher agent',
      };
    }

    return getResearchAnswer(
      launchResult.agentId,
      userEmail,
      launchResult.agentUrl
    );
  },
});

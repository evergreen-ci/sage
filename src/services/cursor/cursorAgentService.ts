import { getDecryptedApiKey } from '@/db/repositories/userCredentialsRepository';
import { type CreateAgentRequest } from '@/generated/cursor-api';
import logger from '@/utils/logger';
import { createCursorApiClient, CursorApiClientError } from './cursorApiClient';
import {
  AddFollowupInput,
  AddFollowupResult,
  AgentConversationInput,
  AgentConversationResult,
  AgentStatusInput,
  AgentStatusResult,
  CursorAgentStatus,
  LaunchAgentInput,
  LaunchAgentResult,
  LaunchResearcherInput,
} from './types';

/**
 * Builds the prompt text from ticket data
 * Interpolates ticket information into the prompt template
 * @param input - The input data containing ticket information
 * @returns The formatted prompt text
 */
export const buildPromptFromTicketData = (input: LaunchAgentInput): string => {
  const { description, summary, ticketKey } = input;

  const descriptionSection = description
    ? `
### Description
${description}`
    : '';

  return `You are "sage-bot", an autonomous engineering agent that implements Jira tickets end-to-end. Your goal is to deliver production-ready code that fully addresses the ticket requirements.

## Your Workflow
1. **Understand** - Analyze the ticket requirements thoroughly before writing any code
2. **Explore** - Examine the existing codebase to understand patterns, conventions, and architecture
3. **Plan** - Outline your implementation approach before coding
4. **Implement** - Write clean, well-structured code following existing patterns
5. **Test** - Add appropriate tests and verify existing tests pass
6. **Review** - Self-review your changes for quality, edge cases, and potential issues

## Quality Standards
- Follow existing code patterns and conventions in the repository
- Write clear, self-documenting code with comments only where necessary
- Include appropriate error handling
- Add or update tests to cover your changes
- Ensure your changes do not break existing functionality
- Keep changes focused and minimal - only implement what the ticket requires

---

## Jira Ticket: ${ticketKey}

### Summary
${summary}${descriptionSection}

---

## Instructions
Implement the changes described in ticket ${ticketKey} above. When complete, provide a concise summary of what you implemented and any important decisions you made.`;
};

/**
 * Converts a GitHub repository URL or org/repo format to full URL
 * Ensures the repository URL is in the correct format for Cursor API
 * @param repository - The repository string (URL or org/repo format)
 * @returns The normalized repository URL
 */
export const normalizeRepositoryUrl = (repository: string): string => {
  // If it's already a full URL, return as-is
  if (repository.startsWith('https://github.com/')) {
    return repository;
  }

  // If it's in org/repo format, convert to full URL
  if (repository.includes('/') && !repository.includes('://')) {
    return `https://github.com/${repository}`;
  }

  // Unexpected format - log warning and return as-is to let the API validate
  logger.warn('Unexpected repository URL format, passing through to API', {
    repository,
  });
  return repository;
};

const TERMINAL_STATUSES: CursorAgentStatus[] = ['FINISHED', 'ERROR', 'EXPIRED'];

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_MAX_WAIT_MS = 15 * 60 * 1000; // 15 minutes

// Shared helper that executes a Cursor agent launch request.
// Handles API key lookup, client creation, and error handling.
const executeCursorAgentRequest = async (
  assigneeEmail: string,
  request: CreateAgentRequest,
  logContext: Record<string, unknown>
): Promise<LaunchAgentResult> => {
  const apiKey = await getDecryptedApiKey(assigneeEmail);

  if (!apiKey) {
    const errorMessage = `No Cursor API key found for assignee: ${assigneeEmail}`;
    logger.error(errorMessage, { assigneeEmail, ...logContext });
    return { success: false, error: errorMessage };
  }

  try {
    const client = createCursorApiClient(apiKey);
    const agentResponse = await client.launchAgent(request);

    logger.info('Cursor agent launched successfully', {
      agentId: agentResponse.id,
      status: agentResponse.status,
      agentUrl: agentResponse.target?.url,
      ...logContext,
    });

    return {
      success: true,
      agentId: agentResponse.id,
      agentUrl: agentResponse.target?.url,
    };
  } catch (error) {
    let errorMessage = 'Failed to launch Cursor agent';

    if (error instanceof CursorApiClientError) {
      errorMessage = `Cursor API error (${error.statusCode}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    logger.error('Failed to launch Cursor agent', {
      error: errorMessage,
      ...logContext,
    });

    return { success: false, error: errorMessage };
  }
};

/**
 * Launches a Cursor Cloud Agent for a Jira ticket
 * @param input - The ticket data and configuration for launching the agent
 * @returns Result indicating success/failure with agent ID and URL
 */
export const launchCursorAgent = async (
  input: LaunchAgentInput
): Promise<LaunchAgentResult> => {
  const {
    assigneeEmail,
    autoCreatePr,
    targetRef,
    targetRepository,
    ticketKey,
  } = input;

  logger.info(`Launching Cursor agent for ticket ${ticketKey}`, {
    targetRepository,
    targetRef: targetRef ?? '(default branch)',
    assigneeEmail,
    autoCreatePr,
  });

  const promptText = buildPromptFromTicketData(input);
  const repositoryUrl = normalizeRepositoryUrl(targetRepository);

  const launchRequest: CreateAgentRequest = {
    prompt: { text: promptText },
    source: {
      repository: repositoryUrl,
      ...(targetRef && { ref: targetRef }),
    },
    target: {
      autoCreatePr: autoCreatePr ?? false,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
  };

  return executeCursorAgentRequest(assigneeEmail, launchRequest, {
    ticketKey,
    targetRepository,
  });
};

/**
 * Launches a Cursor Cloud Agent in research-only mode (no PR creation).
 * The agent explores the codebase and answers the given prompt.
 * @param input - The research request configuration
 * @returns Result indicating success/failure with agent ID and URL
 */
export const launchResearcherAgent = async (
  input: LaunchResearcherInput
): Promise<LaunchAgentResult> => {
  const { prompt, targetRef, targetRepository, userEmail } = input;

  logger.info('Launching Cursor researcher agent', {
    targetRepository,
    targetRef: targetRef ?? '(default branch)',
    userEmail,
  });

  const repositoryUrl = normalizeRepositoryUrl(targetRepository);

  const researchPrompt = `You are a codebase researcher. Your job is to explore this repository and answer the following question thoroughly.

**Do NOT make any code changes or create pull requests.** Your sole task is to investigate the codebase and provide a comprehensive, evidence-based answer.

## Research Question
${prompt}

## Instructions
1. Explore the repository structure to understand the codebase layout
2. Read relevant files, modules, and documentation
3. Trace code paths, dependencies, and data flows as needed
4. Provide a detailed answer with specific file paths, code references, and line numbers where relevant
5. If the answer requires understanding multiple components, explain how they relate to each other`;

  const launchRequest: CreateAgentRequest = {
    prompt: { text: researchPrompt },
    source: {
      repository: repositoryUrl,
      ...(targetRef && { ref: targetRef }),
    },
    target: {
      autoCreatePr: false,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
  };

  return executeCursorAgentRequest(userEmail, launchRequest, {
    targetRepository,
    purpose: 'research',
  });
};

/**
 * Gets the current status of a Cursor Cloud Agent
 * @param input - The agent ID and assignee email (for API key lookup)
 * @returns Result with current status, PR URL, and summary
 */
export const getAgentStatus = async (
  input: AgentStatusInput
): Promise<AgentStatusResult> => {
  const { agentId, assigneeEmail } = input;

  logger.debug(`Getting status for Cursor agent ${agentId}`, {
    agentId,
    assigneeEmail,
  });

  // Get the assignee's decrypted API key
  const apiKey = await getDecryptedApiKey(assigneeEmail);

  if (!apiKey) {
    const errorMessage = `No Cursor API key found for assignee: ${assigneeEmail}`;
    logger.error(errorMessage, { agentId, assigneeEmail });
    return {
      success: false,
      error: errorMessage,
    };
  }

  try {
    // Create client with user's API key and get agent status
    const client = createCursorApiClient(apiKey);
    const agentResponse = await client.getAgent(agentId);

    logger.debug(`Cursor agent status retrieved for ${agentId}`, {
      agentId: agentResponse.id,
      status: agentResponse.status,
      prUrl: agentResponse.target?.prUrl,
    });

    return {
      success: true,
      status: agentResponse.status,
      prUrl: agentResponse.target?.prUrl,
      summary: agentResponse.summary,
      agentUrl: agentResponse.target?.url,
    };
  } catch (error) {
    let errorMessage = 'Failed to get Cursor agent status';

    if (error instanceof CursorApiClientError) {
      errorMessage = `Cursor API error (${error.statusCode}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    logger.error(`Failed to get status for Cursor agent ${agentId}`, {
      error: errorMessage,
      agentId,
      assigneeEmail,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Gets the conversation history of a Cursor Cloud Agent
 * @param input - The agent ID and user email (for API key lookup)
 * @returns Result with conversation messages
 */
export const getAgentConversation = async (
  input: AgentConversationInput
): Promise<AgentConversationResult> => {
  const { agentId, userEmail } = input;

  const apiKey = await getDecryptedApiKey(userEmail);

  if (!apiKey) {
    const errorMessage = `No Cursor API key found for user: ${userEmail}`;
    logger.error(errorMessage, { agentId, userEmail });
    return { success: false, error: errorMessage };
  }

  try {
    const client = createCursorApiClient(apiKey);
    const conversationResponse = await client.getAgentConversation(agentId);

    return {
      success: true,
      messages: conversationResponse.messages,
    };
  } catch (error) {
    let errorMessage = 'Failed to get Cursor agent conversation';

    if (error instanceof CursorApiClientError) {
      errorMessage = `Cursor API error (${error.statusCode}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    logger.error(`Failed to get conversation for Cursor agent ${agentId}`, {
      error: errorMessage,
      agentId,
      userEmail,
    });

    return { success: false, error: errorMessage };
  }
};

/**
 * Sends a follow-up instruction to an existing Cursor Cloud Agent
 * @param input - The agent ID, follow-up text, and user email (for API key lookup)
 * @returns Result indicating success/failure with agent ID
 */
export const addFollowupToAgent = async (
  input: AddFollowupInput
): Promise<AddFollowupResult> => {
  const { agentId, text, userEmail } = input;

  const apiKey = await getDecryptedApiKey(userEmail);

  if (!apiKey) {
    const errorMessage = `No Cursor API key found for user: ${userEmail}`;
    logger.error(errorMessage, { agentId, userEmail });
    return { success: false, error: errorMessage };
  }

  try {
    const client = createCursorApiClient(apiKey);
    const followupResponse = await client.addFollowup(agentId, text);

    logger.info('Follow-up sent to Cursor agent', {
      agentId: followupResponse.id,
    });

    return {
      success: true,
      agentId: followupResponse.id,
    };
  } catch (error) {
    let errorMessage = 'Failed to send follow-up to Cursor agent';

    if (error instanceof CursorApiClientError) {
      errorMessage = `Cursor API error (${error.statusCode}): ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    logger.error(`Failed to send follow-up to Cursor agent ${agentId}`, {
      error: errorMessage,
      agentId,
      userEmail,
    });

    return { success: false, error: errorMessage };
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Polls a Cursor Cloud Agent until it reaches a terminal state (FINISHED, ERROR, EXPIRED).
 * Uses a fixed polling interval with a configurable maximum wait time.
 * @param input - The agent ID and assignee email (for API key lookup)
 * @param options - Optional polling configuration
 * @param options.maxWaitMs - Maximum time to wait before timing out (default: 15 minutes)
 * @param options.pollIntervalMs - Interval between status checks (default: 10 seconds)
 * @returns Result with the final agent status
 */
export const waitForAgentCompletion = async (
  input: AgentStatusInput,
  options?: { maxWaitMs?: number; pollIntervalMs?: number }
): Promise<AgentStatusResult> => {
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const startTime = Date.now();

  logger.info(`Polling Cursor agent ${input.agentId} until completion`, {
    agentId: input.agentId,
    maxWaitMs,
    pollIntervalMs,
  });

  /* eslint-disable no-await-in-loop -- intentional sequential polling */
  while (Date.now() - startTime < maxWaitMs) {
    const statusResult = await getAgentStatus(input);

    if (!statusResult.success) {
      return statusResult;
    }

    if (
      statusResult.status &&
      TERMINAL_STATUSES.includes(statusResult.status)
    ) {
      logger.info(
        `Cursor agent ${input.agentId} reached terminal state: ${statusResult.status}`,
        {
          agentId: input.agentId,
          status: statusResult.status,
          elapsedMs: Date.now() - startTime,
        }
      );
      return statusResult;
    }

    logger.debug(
      `Cursor agent ${input.agentId} still ${statusResult.status}, polling again in ${pollIntervalMs}ms`,
      { agentId: input.agentId, status: statusResult.status }
    );

    await sleep(pollIntervalMs);
  }
  /* eslint-enable no-await-in-loop */

  const errorMessage = `Cursor agent ${input.agentId} did not complete within ${maxWaitMs}ms`;
  logger.warn(errorMessage, { agentId: input.agentId });
  return { success: false, error: errorMessage };
};

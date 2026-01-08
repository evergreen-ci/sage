import { getDecryptedApiKey } from '@/db/repositories/userCredentialsRepository';
import logger from '@/utils/logger';
import {
  Sdk,
  type CreateAgentRequest,
  type Error as CursorError,
} from './generated';
import { createClient, createConfig } from './generated/client';
import { LaunchAgentInput, LaunchAgentResult } from './types';

/**
 * Creates a configured Cursor SDK instance
 * @param apiKey - The Cursor API key for authentication
 * @returns Configured Sdk instance
 */
const createCursorSdk = (apiKey: string): Sdk => {
  const client = createClient(
    createConfig({
      baseUrl: 'https://api.cursor.com',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
  );
  return new Sdk({ client });
};

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
    targetRef,
    assigneeEmail,
    autoCreatePr,
  });

  // Validate targetRef before proceeding
  if (!targetRef) {
    const errorMessage = `No target ref provided for ticket ${ticketKey}`;
    logger.error(errorMessage, { ticketKey, targetRepository });
    return {
      success: false,
      error: errorMessage,
    };
  }

  // Get the assignee's decrypted API key
  const apiKey = await getDecryptedApiKey(assigneeEmail);

  if (!apiKey) {
    const errorMessage = `No API key found for assignee: ${assigneeEmail}`;
    logger.error(errorMessage, { ticketKey, assigneeEmail });
    return {
      success: false,
      error: errorMessage,
    };
  }

  // Build the prompt from ticket data
  const promptText = buildPromptFromTicketData(input);

  // Normalize the repository URL
  const repositoryUrl = normalizeRepositoryUrl(targetRepository);

  // Build the launch request
  const launchRequest: CreateAgentRequest = {
    prompt: {
      text: promptText,
    },
    source: {
      repository: repositoryUrl,
      ref: targetRef,
    },
    target: {
      autoCreatePr: autoCreatePr ?? false,
      openAsCursorGithubApp: false,
      skipReviewerRequest: false,
    },
  };

  // Create SDK with user's API key and launch agent
  const sdk = createCursorSdk(apiKey);

  logger.info('Launching Cursor cloud agent', {
    repository: launchRequest.source.repository,
    ref: launchRequest.source.ref,
    autoCreatePr: launchRequest.target?.autoCreatePr,
  });

  const response = await sdk.createAgent({
    body: launchRequest,
    throwOnError: false,
  });

  if (response.error) {
    const cursorError = response.error as CursorError;
    const errorMessage =
      cursorError.error?.message || 'Unknown Cursor API error';
    const errorCode = cursorError.error?.code;

    logger.error(`Failed to launch Cursor agent for ticket ${ticketKey}`, {
      error: errorMessage,
      code: errorCode,
      statusCode: response.response.status,
      ticketKey,
      targetRepository,
    });

    return {
      success: false,
      error: `Cursor API error (${response.response.status}): ${errorMessage}`,
    };
  }

  const agentResponse = response.data;

  logger.info(`Cursor agent launched successfully for ticket ${ticketKey}`, {
    agentId: agentResponse.id,
    status: agentResponse.status,
    agentUrl: agentResponse.target?.url,
  });

  return {
    success: true,
    agentId: agentResponse.id,
    agentUrl: agentResponse.target?.url,
  };
};

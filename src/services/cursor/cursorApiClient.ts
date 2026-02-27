import {
  Sdk,
  type CreateAgentRequest,
  type CreateAgentResponse,
  type GetAgentResponse,
} from '@/generated/cursor-api';
import { createClient, createConfig } from '@/generated/cursor-api/client';
import logger from '@/utils/logger';

/**
 * Normalize Cursor API error response to a consistent shape.
 * Actual API returns: { error: string, code?: string }
 * Spec format: { error: { message?: string, code?: string } }
 * @param raw - The raw error response from the Cursor API
 * @returns Normalized error with message and optional code
 */
const parseCursorError = (raw: unknown): { message: string; code?: string } => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = raw as any;
  return {
    message:
      (typeof err?.error === 'string' ? err.error : err?.error?.message) ||
      'Unknown Cursor API error',
    code: err?.code ?? err?.error?.code,
  };
};

/** Error message patterns for intermittent Cursor API branch identification failures */
export const BRANCH_ERROR_PATTERNS = [
  'Failed to determine repository default branch',
  'Failed to verify existence of branch',
];

export const LAUNCH_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 10000,
};

/**
 * Checks whether a Cursor API error is a transient branch identification failure
 * that should be retried. These errors are intermittent on the Cursor side and
 * often resolve on subsequent attempts.
 * @param message - The error message from the Cursor API response
 * @param statusCode - The HTTP status code from the Cursor API response
 * @returns True if the error is a retryable branch identification failure
 */
export const isBranchIdentificationError = (
  message: string,
  statusCode: number
): boolean =>
  statusCode === 400 &&
  BRANCH_ERROR_PATTERNS.some(pattern => message.includes(pattern));

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Error class for Cursor API errors
 */
export class CursorApiClientError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'CursorApiClientError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Cursor Cloud Agents API client
 * Uses Bearer Authentication with the user's API key
 */
export class CursorApiClient {
  private readonly sdk: Sdk;

  constructor(apiKey: string) {
    const client = createClient(
      createConfig({
        baseUrl: 'https://api.cursor.com',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
    );
    this.sdk = new Sdk({ client });
  }

  /**
   * Launch a new cloud agent with automatic retry for transient branch
   * identification failures from the Cursor API.
   * POST /v0/agents
   * @param request - The launch agent request configuration
   * @returns The agent response with status and details
   */
  async launchAgent(request: CreateAgentRequest): Promise<CreateAgentResponse> {
    logger.info('Launching Cursor cloud agent', {
      repository: request.source.repository,
      ref: request.source.ref,
      autoCreatePr: request.target?.autoCreatePr,
    });

    const maxAttempts = LAUNCH_RETRY_CONFIG.maxRetries + 1;

    /* eslint-disable no-await-in-loop -- sequential retries with backoff are inherently serial */
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await this.sdk.createAgent({
        body: request,
        throwOnError: false,
      });

      if (response.error) {
        const err = parseCursorError(response.error);
        const statusCode = response.response.status;

        if (
          attempt < maxAttempts &&
          isBranchIdentificationError(err.message, statusCode)
        ) {
          const delay = Math.min(
            LAUNCH_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
            LAUNCH_RETRY_CONFIG.maxDelayMs
          );
          logger.warn(
            `Cursor API branch identification error (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`,
            {
              error: err.message,
              statusCode,
              attempt,
              maxAttempts,
              retryDelayMs: delay,
              repository: request.source.repository,
              ref: request.source.ref,
            }
          );
          await sleep(delay);
          continue;
        }

        logger.error(`Cursor API error: ${err.message}`, {
          statusCode,
          code: err.code,
          ...(attempt > 1 && { finalAttempt: attempt, maxAttempts }),
        });

        throw new CursorApiClientError(err.message, statusCode, err.code);
      }

      const agentResponse = response.data;

      logger.info('Cursor agent launched successfully', {
        agentId: agentResponse.id,
        status: agentResponse.status,
        targetUrl: agentResponse.target?.url,
        ...(attempt > 1 && { attemptsTaken: attempt }),
      });

      return agentResponse;
    }
    /* eslint-enable no-await-in-loop */

    throw new Error('Unexpected: launch retry loop exited without result');
  }

  /**
   * Get the status of an existing cloud agent
   * GET /v0/agents/{id}
   * @param agentId - The unique identifier of the agent
   * @returns The agent response with current status and details
   */
  async getAgent(agentId: string): Promise<GetAgentResponse> {
    logger.debug('Fetching Cursor agent status', { agentId });

    const response = await this.sdk.getAgent({
      path: { id: agentId },
      throwOnError: false,
    });

    if (response.error) {
      const err = parseCursorError(response.error);

      logger.error(`Cursor API error fetching agent: ${err.message}`, {
        agentId,
        statusCode: response.response.status,
        code: err.code,
      });

      throw new CursorApiClientError(
        err.message,
        response.response.status,
        err.code
      );
    }

    const agentResponse = response.data;

    logger.debug('Cursor agent status retrieved', {
      agentId: agentResponse.id,
      status: agentResponse.status,
    });

    return agentResponse;
  }
}

/**
 * Creates a new CursorApiClient instance with the given API key
 * @param apiKey - The Cursor API key for authentication
 * @returns A new CursorApiClient instance
 */
export const createCursorApiClient = (apiKey: string): CursorApiClient =>
  new CursorApiClient(apiKey);

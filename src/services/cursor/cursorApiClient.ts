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
   * Launch a new cloud agent
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

    const response = await this.sdk.createAgent({
      body: request,
      throwOnError: false,
    });

    if (response.error) {
      const err = parseCursorError(response.error);

      logger.error(`Cursor API error: ${err.message}`, {
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

    logger.info('Cursor agent launched successfully', {
      agentId: agentResponse.id,
      status: agentResponse.status,
      targetUrl: agentResponse.target?.url,
    });

    return agentResponse;
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

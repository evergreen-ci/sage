import {
  Sdk,
  type CreateAgentRequest,
  type CreateAgentResponse,
  type Error as CursorError,
} from '@/generated/cursor-api';
import { createClient, createConfig } from '@/generated/cursor-api/client';
import logger from '@/utils/logger';

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
      const cursorError = response.error as CursorError;
      const errorMessage =
        cursorError.error?.message || 'Unknown Cursor API error';
      const errorCode = cursorError.error?.code;

      logger.error(`Cursor API error: ${errorMessage}`, {
        statusCode: response.response.status,
        code: errorCode,
      });

      throw new CursorApiClientError(
        errorMessage,
        response.response.status,
        errorCode
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
}

/**
 * Creates a new CursorApiClient instance with the given API key
 * @param apiKey - The Cursor API key for authentication
 * @returns A new CursorApiClient instance
 */
export const createCursorApiClient = (apiKey: string): CursorApiClient =>
  new CursorApiClient(apiKey);

import logger from '@/utils/logger';
import {
  CursorAgentResponse,
  CursorApiError,
  LaunchAgentRequest,
  cursorAgentResponseSchema,
} from './types';

const CURSOR_API_BASE_URL = 'https://api.cursor.com';

/**
 * Error class for Cursor API errors
 */
export class CursorApiClientError extends Error {
  readonly statusCode: number;
  readonly responseBody?: string;

  constructor(message: string, statusCode: number, responseBody?: string) {
    super(message);
    this.name = 'CursorApiClientError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/**
 * Cursor Cloud Agents API client
 * Uses Basic Authentication with the user's API key
 */
export class CursorApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string = CURSOR_API_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Creates the Authorization header for Basic Auth
   * Cursor API uses apiKey as username with empty password
   * @returns The Basic Auth header value
   */
  private getAuthHeader(): string {
    // Basic auth format: base64(username:password)
    // For Cursor API: base64(apiKey:)
    const credentials = Buffer.from(`${this.apiKey}:`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Makes an authenticated request to the Cursor API
   * @param method - The HTTP method to use
   * @param path - The API path to call
   * @param body - Optional request body
   * @returns The parsed response data
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    logger.debug(`Making Cursor API request: ${method} ${path}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const responseText = await response.text();
      let errorMessage = `Cursor API request failed: ${response.status} ${response.statusText}`;

      try {
        const errorBody = JSON.parse(responseText) as CursorApiError;
        if (errorBody.error) {
          errorMessage = errorBody.error;
        } else if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // If we can't parse JSON, use the raw response
        if (responseText) {
          errorMessage = responseText;
        }
      }

      logger.error(`Cursor API error: ${errorMessage}`, {
        statusCode: response.status,
        path,
        method,
      });

      throw new CursorApiClientError(
        errorMessage,
        response.status,
        responseText
      );
    }

    const data = await response.json();
    return data as T;
  }

  /**
   * Launch a new cloud agent
   * POST /v0/agents
   * @param request - The launch agent request configuration
   * @returns The agent response with status and details
   */
  async launchAgent(request: LaunchAgentRequest): Promise<CursorAgentResponse> {
    logger.info('Launching Cursor cloud agent', {
      repository: request.source.repository,
      ref: request.source.ref,
      autoCreatePr: request.target?.autoCreatePr,
    });

    const response = await this.makeRequest<CursorAgentResponse>(
      'POST',
      '/v0/agents',
      request
    );

    // Validate response against schema
    const validated = cursorAgentResponseSchema.parse(response);

    logger.info('Cursor agent launched successfully', {
      agentId: validated.id,
      status: validated.status,
      targetUrl: validated.target?.url,
    });

    return validated;
  }
}

/**
 * Creates a new CursorApiClient instance with the given API key
 * @param apiKey - The Cursor API key for authentication
 * @returns A new CursorApiClient instance
 */
export const createCursorApiClient = (apiKey: string): CursorApiClient =>
  new CursorApiClient(apiKey);

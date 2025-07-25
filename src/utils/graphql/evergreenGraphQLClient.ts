import { config } from '../../config';
import { logger } from '../logger';

/**
 * GraphQL query result type
 */
interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
}

/**
 * GraphQL request options
 */
interface GraphQLRequestOptions {
  query: string;
  variables?: Record<string, unknown> | undefined;
  operationName?: string | undefined;
}

/**
 * Evergreen GraphQL Client error class
 * @param message - The error message
 * @param errors - The errors returned from the GraphQL query
 * @param statusCode - The status code of the response
 * This class is used to throw errors when the GraphQL query fails and ensure that the error is logged appropriately
 */
class EvergreenGraphQLError extends Error {
  public readonly errors: GraphQLResponse['errors'];
  public readonly statusCode: number | undefined;

  constructor(
    message: string,
    errors?: GraphQLResponse['errors'],
    statusCode?: number
  ) {
    super(message);
    this.name = 'EvergreenGraphQLError';
    this.errors = errors;
    this.statusCode = statusCode;
  }
}

type ExecuteQueryOptions = {
  operationName?: string;
  userID?: string;
};

/**
 * Evergreen GraphQL Client
 *
 * Provides a simple interface for executing GraphQL queries against the Evergreen API.
 */
class EvergreenGraphQLClient {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;

  constructor() {
    this.endpoint = config.evergreen.graphql.endpoint;
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Api-Key': config.evergreen.graphql.apiKey,
      'Api-User': config.evergreen.graphql.apiUser,
    };
  }

  /**
   * Execute a GraphQL query against the Evergreen API
   * @param query - GraphQL query string or document
   * @param variables - Optional variables for the query
   * @param options - Optional options for the query
   * @param options.operationName - Optional operation name
   * @returns Promise resolving to the query result
   * @throws EvergreenGraphQLError if the request fails or contains GraphQL errors
   */
  async executeQuery<
    T = unknown,
    V extends Record<string, unknown> = Record<string, unknown>,
  >(query: string, variables?: V, options?: ExecuteQueryOptions): Promise<T> {
    const requestBody: GraphQLRequestOptions = {
      query,
      ...(variables !== undefined && { variables }),
      ...(options?.operationName !== undefined && {
        operationName: options.operationName,
      }),
    };

    // This is a temporary measure to allow the API to run as a user
    // TODO: Remove this once we have a proper authentication system
    const requestHeaders = { ...this.headers };
    if (options?.userID) {
      // TODO: DEVPROD-19200 - Use the same header as the API
      requestHeaders['End-User'] = options.userID;
    }
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('GraphQL request failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new EvergreenGraphQLError(
          `HTTP ${response.status}: ${response.statusText}`,
          undefined,
          response.status
        );
      }

      const result = (await response.json()) as GraphQLResponse<T>;

      // Check for GraphQL errors
      if (result.errors && result.errors.length > 0) {
        logger.error('GraphQL query returned errors', {
          errors: result.errors,
          operationName: options?.operationName,
        });
        throw new EvergreenGraphQLError(
          `GraphQL errors: ${result.errors.map(err => err.message).join(', ')}`,
          result.errors
        );
      }

      if (!result.data) {
        logger.warn('GraphQL query returned no data', {
          operationName: options?.operationName,
        });
      }

      logger.debug('GraphQL query executed successfully', {
        operationName: options?.operationName,
        hasData: !!result.data,
      });

      return result.data as T;
    } catch (error) {
      if (error instanceof EvergreenGraphQLError) {
        throw error;
      }

      logger.error('Unexpected error during GraphQL request', {
        error: error instanceof Error ? error.message : String(error),
        operationName: options?.operationName,
      });

      throw new EvergreenGraphQLError(
        `Network or parsing error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export const evergreenGraphQLClient = new EvergreenGraphQLClient();

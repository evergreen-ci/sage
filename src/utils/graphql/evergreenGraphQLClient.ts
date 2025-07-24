import { config } from '../../config';
import { logger } from '../logger';

/**
 * GraphQL query result type
 */
interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, any>;
  }>;
}

/**
 * GraphQL request options
 */
interface GraphQLRequestOptions {
  query: string;
  variables?: Record<string, any> | undefined;
  operationName?: string | undefined;
}

/**
 * Evergreen GraphQL Client error class
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
   * @param operationName - Optional operation name
   * @returns Promise resolving to the query result
   * @throws EvergreenGraphQLError if the request fails or contains GraphQL errors
   */
  async executeQuery<T = any, V extends Record<string, any> = Record<string, any>>(
    query: string,
    variables?: V,
    operationName?: string
  ): Promise<T> {
    const requestBody: GraphQLRequestOptions = {
      query,
      ...(variables !== undefined && { variables }),
      ...(operationName !== undefined && { operationName }),
    };


    logger.debug('Executing GraphQL query', {
      operationName,
      variables: variables ? Object.keys(variables) : undefined,
      endpoint: this.endpoint,
      requestBody,
    });

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
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
          operationName,
        });
        throw new EvergreenGraphQLError(
          `GraphQL errors: ${result.errors.map(err => err.message).join(', ')}`,
          result.errors
        );
      }

      if (!result.data) {
        logger.warn('GraphQL query returned no data', { operationName });
      }

      logger.debug('GraphQL query executed successfully', {
        operationName,
        hasData: !!result.data,
      });

      return result.data as T;
    } catch (error) {
      if (error instanceof EvergreenGraphQLError) {
        throw error;
      }

      logger.error('Unexpected error during GraphQL request', {
        error: error instanceof Error ? error.message : String(error),
        operationName,
      });

      throw new EvergreenGraphQLError(
        `Network or parsing error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute a mutation against the Evergreen API
   * Alias for executeQuery for semantic clarity
   * @param mutation - GraphQL mutation string
   * @param variables - Optional variables for the mutation
   * @param operationName - Optional operation name for debugging
   * @returns Promise resolving to the mutation result data
   */
  async executeMutation<T = any>(
    mutation: string,
    variables?: Record<string, any>,
    operationName?: string
  ): Promise<T> {
    return this.executeQuery<T>(mutation, variables, operationName);
  }
}

// Export singleton instance
export const evergreenGraphQLClient = new EvergreenGraphQLClient();

// Export class for custom instances if needed
export { EvergreenGraphQLClient, EvergreenGraphQLError };

// Export types
export type { GraphQLResponse, GraphQLRequestOptions };

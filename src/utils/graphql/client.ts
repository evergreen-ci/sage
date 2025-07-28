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
  variables?: Record<string, unknown>;
  operationName?: string;
}

/**
 * Generic GraphQL client error
 */
export class GraphQLClientError extends Error {
  public readonly errors?: GraphQLResponse['errors'];
  public readonly statusCode?: number;

  constructor(
    message: string,
    errors?: GraphQLResponse['errors'],
    statusCode?: number
  ) {
    super(message);
    this.name = 'GraphQLClientError';
    this.errors = errors;
    this.statusCode = statusCode;
  }
}

interface ExecuteQueryOptions {
  operationName?: string;
  headers?: Record<string, string>;
}

/**
 * Generic GraphQL client for making typed queries
 */
export class GraphQLClient {
  private readonly endpoint: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(endpoint: string, headers?: Record<string, string>) {
    this.endpoint = endpoint;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    };
  }

  /**
   * Executes a GraphQL query against the configured endpoint.
   * @param query - GraphQL query string
   * @param variables - Optional query variables
   * @param options - Optional operationName and additional headers
   * @returns Parsed data response
   * @throws GraphQLClientError on failure or errors
   */
  async executeQuery<
    T = unknown,
    V extends Record<string, unknown> = Record<string, unknown>,
  >(query: string, variables?: V, options?: ExecuteQueryOptions): Promise<T> {
    const requestBody: GraphQLRequestOptions = {
      query,
      ...(variables && { variables }),
      ...(options?.operationName && { operationName: options.operationName }),
    };

    const headers = {
      ...this.defaultHeaders,
      ...options?.headers,
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let error: GraphQLResponse['errors'];
        try {
          error = JSON.parse(errorText);
        } catch (err) {
          throw new GraphQLClientError(
            `HTTP ${response.status}: ${response.statusText}`,
            undefined,
            response.status
          );
        }

        throw new GraphQLClientError(
          `HTTP ${response.status}: ${response.statusText}`,
          error,
          response.status
        );
      }

      const result = (await response.json()) as GraphQLResponse<T>;

      if (result.errors?.length) {
        throw new GraphQLClientError(
          `GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`,
          result.errors
        );
      }

      if (!result.data) {
        console.warn('GraphQL query returned no data');
      }

      return result.data as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new GraphQLClientError(`Network or parsing error: ${message}`);
    }
  }
}

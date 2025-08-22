import { EVERGREEN_USER_HEADER } from '../../constants/headers';
import logger from '../logger';

/** Minimal GraphQL response shape */
interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
    extensions?: Record<string, unknown>;
  }>;
}

interface GraphQLRequestOptions<
  V extends Record<string, unknown> = Record<string, unknown>,
> {
  query: string;
  variables?: V;
  operationName?: string;
}

interface ExecuteQueryOptions {
  operationName?: string;
  headers?: Record<string, string>;
  userID: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Unified client error for HTTP/GraphQL/parse issues */
export class GraphQLClientError extends Error {
  readonly statusCode?: number;
  readonly errors?: GraphQLResponse['errors'];
  readonly responseBody?: unknown;
  override readonly cause?: unknown;

  constructor(
    msg: string,
    opts?: {
      statusCode?: number;
      errors?: GraphQLResponse['errors'];
      responseBody?: unknown;
      cause?: unknown;
    }
  ) {
    super(msg);
    this.name = 'GraphQLClientError';
    if (opts?.statusCode !== undefined) {
      this.statusCode = opts.statusCode; // ok with exactOptionalPropertyTypes
    }
    this.errors = opts?.errors;
    this.responseBody = opts?.responseBody;
    this.cause = opts?.cause; // manual attach, no ErrorOptions needed
  }
}

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

  async executeQuery<
    T = unknown,
    V extends Record<string, unknown> = Record<string, unknown>,
  >(
    query: string,
    variables: V | undefined,
    options: ExecuteQueryOptions
  ): Promise<T> {
    const body: GraphQLRequestOptions<V> = {
      query,
      ...(variables && Object.keys(variables).length ? { variables } : {}),
      ...(options.operationName
        ? { operationName: options.operationName }
        : {}),
    };

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...options.headers,
      [EVERGREEN_USER_HEADER]: options.userID,
    };

    // Timeout using AbortController
    const ac =
      !options.signal && options.timeoutMs ? new AbortController() : undefined;
    const timeout = ac
      ? setTimeout(() => ac.abort(), options.timeoutMs)
      : undefined;
    const signal = options.signal ?? ac?.signal;

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      const contentType = res.headers.get('content-type') ?? '';
      const isJson = contentType.toLowerCase().includes('application/json');

      if (!res.ok) {
        const raw = await safeReadBody(res, isJson);
        const parsed = isPlainObject(raw)
          ? (raw as Partial<GraphQLResponse>)
          : undefined;

        throw new GraphQLClientError(`HTTP ${res.status} ${res.statusText}`, {
          statusCode: res.status,
          errors: parsed?.errors,
          responseBody: parsed ?? raw,
        });
      }

      let payload: GraphQLResponse<T>;
      if (isJson) {
        const json = await res.json();
        if (!isPlainObject(json)) {
          throw new GraphQLClientError(
            'Response is not a valid GraphQL response',
            {
              statusCode: res.status,
              responseBody: json,
            }
          );
        }
        payload = json as GraphQLResponse<T>;
      } else {
        const forced = await forceJson<T>(res);
        if (!isPlainObject(forced)) {
          throw new GraphQLClientError(
            'Response is not a valid GraphQL response',
            {
              statusCode: res.status,
              responseBody: forced,
            }
          );
        }
        payload = forced as GraphQLResponse<T>;
      }

      if (
        payload.errors &&
        Array.isArray(payload.errors) &&
        payload.errors.length > 0
      ) {
        throw new GraphQLClientError(
          `GraphQL errors: ${payload.errors.map(e => e.message).join(', ')}`,
          { statusCode: 200, errors: payload.errors, responseBody: payload }
        );
      }

      if (payload.data === undefined) {
        logger.warn('GraphQL query returned no data', {
          operationName: options.operationName,
        });
        return undefined as unknown as T;
      }

      return payload.data;
    } catch (err) {
      if (isAbortError(err)) {
        throw new GraphQLClientError('Request was aborted', { cause: err });
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new GraphQLClientError(`Network or parsing error: ${msg}`, {
        cause: err,
      });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
/**
 * Determines whether the given error is an AbortError.
 * @param err - The error to check.
 * @returns True if the error is an AbortError, otherwise false.
 */
const isAbortError = (err: unknown): boolean =>
  !!err &&
  typeof err === 'object' &&
  'name' in err &&
  (err as any).name === 'AbortError';

/**
 * Checks if a value is a plain object (i.e., created with `{}` or `Object.create(null)`).
 * @param v - The value to check.
 * @returns True if the value is a plain object, otherwise false.
 */
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' &&
  v !== null &&
  Object.getPrototypeOf(v) === Object.prototype;

/**
 * Safely reads and parses the body of a Response.
 *
 * If the response is JSON, attempts to parse as JSON.
 * If it's not JSON, returns text or parses as JSON if possible.
 * Returns undefined if parsing fails entirely.
 * @param res - The fetch Response object.
 * @param isJson - Whether the response is expected to be JSON.
 * @returns The parsed body as JSON, text, or undefined.
 */
const safeReadBody = async (
  res: Response,
  isJson: boolean
): Promise<unknown> => {
  try {
    if (isJson) return await res.json();
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return undefined;
  }
};

/**
 * Forces parsing of a Response body as JSON, throwing if parsing fails.
 * @typeParam T - Expected GraphQL data type.
 * @param res - The fetch Response object.
 * @throws GraphQLClientError if the body cannot be parsed as JSON.
 * @returns The parsed GraphQLResponse.
 */
const forceJson = async <T>(res: Response): Promise<GraphQLResponse<T>> => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new GraphQLClientError(
      'Expected JSON response but got non-JSON body',
      {
        statusCode: res.status,
        responseBody: text,
      }
    );
  }
};

import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  userId?: string;
  requestId?: string;
}

// Create an async local storage instance for request context
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Set the request context for the current async execution
 * @param context
 * @param fn
 */
export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return requestContextStorage.run(context, fn);
}

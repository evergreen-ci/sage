import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  userId?: string;
  requestId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context
 * @returns The current request context or undefined if not in a context
 */
export const getRequestContext = (): RequestContext | undefined => {
  return requestContextStorage.getStore();
};

/**
 * Set the request context for the current async execution
 * @param context - The request context to set
 * @param fn - The function to run with the context
 * @returns The result of the function
 */
export const runWithRequestContext = <T>(
  context: RequestContext,
  fn: () => T
): T => {
  return requestContextStorage.run(context, fn);
};

import * as Sentry from '@sentry/node';
import { config } from '@/config';

type SentryUser = {
  id?: string;
  email?: string;
  ip_address?: string;
};

type SentryContext = {
  [key: string]: Record<string, unknown>;
};

type SentryTag = {
  [key: string]: string | number | boolean;
};

class SentryService {
  /**
   * Check if Sentry is enabled and configured
   * @returns True if Sentry is initialized and enabled
   */
  isInitialized(): boolean {
    return config.sentry.enabled && !!config.sentry.dsn;
  }

  /**
   * Capture an exception with optional context
   * @param error - The error to capture (Error, string, or unknown)
   * @param context - Optional context information
   * @param context.user - User information
   * @param context.tags - Tags to attach to the event
   * @param context.contexts - Additional contexts
   * @param context.extra - Extra data to include
   * @param context.level - Severity level
   * @param context.fingerprint - Custom fingerprint for grouping
   * @returns Event ID if captured, undefined otherwise
   */
  captureException(
    error: Error | string | unknown,
    context?: {
      user?: SentryUser;
      tags?: SentryTag;
      contexts?: SentryContext;
      extra?: Record<string, unknown>;
      level?: Sentry.SeverityLevel;
      fingerprint?: string[];
    }
  ): string | undefined {
    if (!this.isInitialized()) {
      return undefined;
    }

    return Sentry.withScope(scope => {
      if (context) {
        if (context.user) {
          scope.setUser(context.user);
        }

        if (context.tags) {
          Object.entries(context.tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }

        if (context.contexts) {
          Object.entries(context.contexts).forEach(([key, value]) => {
            scope.setContext(key, value);
          });
        }

        if (context.extra) {
          Object.entries(context.extra).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }

        if (context.level) {
          scope.setLevel(context.level);
        }

        if (context.fingerprint) {
          scope.setFingerprint(context.fingerprint);
        }
      }

      return Sentry.captureException(error);
    });
  }

  /**
   * Add a breadcrumb for context tracking
   * @param breadcrumb - The breadcrumb to add
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.isInitialized()) {
      return;
    }

    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Flush all pending events to Sentry
   * @param timeout - Optional timeout in milliseconds
   * @returns Promise that resolves to true when flush completes
   */
  async flush(timeout?: number): Promise<boolean> {
    if (!this.isInitialized()) {
      return true;
    }

    return Sentry.flush(timeout);
  }

  /**
   * Close the Sentry client and flush all pending events
   * @returns Promise that resolves to true when close completes
   */
  async close(): Promise<boolean> {
    if (!this.isInitialized()) {
      return true;
    }

    return Sentry.close();
  }

  /**
   * Configure the current scope with custom data
   * @param callback - Function to configure the scope
   * @deprecated Use Sentry.withScope() directly for better isolation
   */
  configureScope(callback: (scope: Sentry.Scope) => void): void {
    if (!this.isInitialized()) {
      return;
    }

    callback(Sentry.getCurrentScope());
  }
}
export const sentryService = new SentryService();
export { Sentry };

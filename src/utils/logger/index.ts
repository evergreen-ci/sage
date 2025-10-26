import loggerInstance from './setup';

/**
 * Logs an error message at the error level, with optional error and metadata.
 * Note: Error logs are automatically sent to Sentry via the Winston transport
 * configured in setup.ts
 * @param message - The error message to log.
 * @param error - (Optional) An Error object or unknown error.
 * @param meta - (Optional) Additional metadata to include in the log.
 */
const logError = (
  message: string,
  error?: Error | unknown,
  meta?: Record<string, unknown>
) => {
  if (error instanceof Error) {
    loggerInstance.error(message, {
      error: error.message,
      stack: error.stack,
      ...meta,
    });
  } else {
    loggerInstance.error(message, { error, ...meta });
  }
};

/**
 * Logs a warning message at the warn level, with optional metadata.
 * @param message - The warning message to log.
 * @param meta - (Optional) Additional metadata to include in the log.
 */
const logWarn = (message: string, meta?: Record<string, unknown>) => {
  loggerInstance.warn(message, meta);
};

/**
 * Logs an informational message at the info level, with optional metadata.
 * @param message - The info message to log.
 * @param meta - (Optional) Additional metadata to include in the log.
 */
const logInfo = (message: string, meta?: Record<string, unknown>) => {
  loggerInstance.info(message, meta);
};

/**
 * Logs a debug message at the debug level, with optional metadata.
 * @param message - The debug message to log.
 * @param meta - (Optional) Additional metadata to include in the log.
 */
const logDebug = (message: string, meta?: Record<string, unknown>) => {
  loggerInstance.debug(message, meta);
};

/**
 * Logs an HTTP message at the http level, with optional metadata.
 * @param message - The HTTP message to log.
 * @param meta - (Optional) Additional metadata to include in the log.
 */
const logHttp = (message: string, meta?: Record<string, unknown>) => {
  loggerInstance.http(message, meta);
};

/**
 * Logs an audit event at the info level with action, resource, userId, and optional metadata.
 * @param action - The action performed (e.g., "login", "delete").
 * @param resource - The resource affected (e.g., "user", "document").
 * @param userId - (Optional) The user ID who performed the action.
 * @param metadata - (Optional) Additional metadata to include in the log.
 */
const logAudit = (
  action: string,
  resource: string,
  userId?: string,
  metadata?: Record<string, unknown>
) => {
  loggerInstance.info('AUDIT', {
    action,
    resource,
    userId,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

/**
 * Logs a security event at the warn level with event, severity, and optional details.
 * @param event - The security event description.
 * @param severity - The severity of the event ('low' | 'medium' | 'high' | 'critical').
 * @param details - (Optional) Additional details about the security event.
 */
const logSecurity = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details?: Record<string, unknown>
) => {
  loggerInstance.warn('SECURITY', {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

/**
 * Logger object with methods for different log levels.
 */
const logger = {
  http: logHttp,
  error: logError,
  warn: logWarn,
  info: logInfo,
  debug: logDebug,
  audit: logAudit,
  security: logSecurity,
};

/**
 * Stream object for HTTP request logging (e.g., for morgan/express-winston).
 * write - Function to write a message to the logger at HTTP level.
 */
export const loggerStream = {
  write: (message: string) => {
    loggerInstance.http(message.trim());
  },
};

export default loggerInstance;
export { logger };

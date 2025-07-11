import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from 'config';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Tell winston about the colors
winston.addColors(logColors);

// Define log format for production (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(info => {
    const { level, message, stack, timestamp, ...extra } = info;
    const logEntry: Record<string, any> = {
      timestamp,
      level,
      message,
    };

    if (stack) {
      logEntry.stack = stack;
    }

    Object.assign(logEntry, extra);

    return JSON.stringify(logEntry);
  })
);

/**
 * This is a colorized log format for easy to read logs in development
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(info => {
    const { level, message, stack, timestamp, ...extra } = info;
    let log = `${timestamp} [${level}]: ${message}`;

    if (Object.keys(extra).length > 0) {
      log += `\n${JSON.stringify(extra, null, 2)}`;
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// Create console transport this will print to the console
const consoleTransport = new winston.transports.Console({
  format:
    config.nodeEnv === 'production' ? productionFormat : developmentFormat,
});

// Create file transport for all logs
const fileTransport = new DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: productionFormat,
});

// Create file transport for error logs only
const errorFileTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: productionFormat,
});

// Create the logger instance
const transports: winston.transport[] = [consoleTransport];
if (config.logging.logToFile) {
  transports.push(fileTransport, errorFileTransport);
}

const logger = winston.createLogger({
  level: config.logging.logLevel,
  levels: logLevels,
  transports,
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
  // Exit on handled exceptions
  exitOnError: false,
});

/**
 * Stream object for HTTP request logging (e.g., for morgan/express-winston).
 * write - Function to write a message to the logger at HTTP level.
 */
export const loggerStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

/**
 * Returns a child logger with the given requestId in its context.
 * @param requestId - The request ID to include in the log context.
 * @returns A winston child logger with requestId.
 */
export const withRequestId = (requestId: string) => logger.child({ requestId });

/**
 * Returns a child logger with the given userId and optional email in its context.
 * @param userId - The user ID to include in the log context.
 * @returns A winston child logger with userId.
 */
export const withUser = (userId: string) => logger.child({ userId });

/**
 * Returns a child logger with operation name and timing duration in its context.
 * @param operation - The name of the operation.
 * @param startTime - The start time in milliseconds (from Date.now()).
 * @returns A winston child logger with operation and duration.
 */
export const withTiming = (operation: string, startTime: number) => {
  const duration = Date.now() - startTime;
  return logger.child({ operation, duration });
};

export default logger;

/**
 * Logs an error message at the error level, with optional error and metadata.
 * @param message - The error message to log.
 * @param error - (Optional) An Error object or unknown error.
 * @param meta - (Optional) Additional metadata to include in the log.
 */
export const logError = (
  message: string,
  error?: Error | unknown,
  meta?: Record<string, any>
) => {
  if (error instanceof Error) {
    logger.error(message, {
      error: error.message,
      stack: error.stack,
      ...meta,
    });
  } else {
    logger.error(message, { error, ...meta });
  }
};

/**
 * Logs a warning message at the warn level, with optional metadata.
 * @param message - The warning message to log.
 * @param meta - (Optional) Additional metadata to include in the log.
 */
export const logWarn = (message: string, meta?: Record<string, any>) => {
  logger.warn(message, meta);
};

/**
 * Logs an informational message at the info level, with optional metadata.
 * @param message - The info message to log.
 * @param meta - (Optional) Additional metadata to include in the log.
 */
export const logInfo = (message: string, meta?: Record<string, any>) => {
  logger.info(message, meta);
};

/**
 * Logs a debug message at the debug level, with optional metadata.
 * @param message - The debug message to log.
 * @param meta - (Optional) Additional metadata to include in the log.
 */
export const logDebug = (message: string, meta?: Record<string, any>) => {
  logger.debug(message, meta);
};

/**
 * Logs an HTTP message at the http level, with optional metadata.
 * @param message - The HTTP message to log.
 * @param meta - (Optional) Additional metadata to include in the log.
 */
export const logHttp = (message: string, meta?: Record<string, any>) => {
  logger.http(message, meta);
};

/**
 * Logs an audit event at the info level with action, resource, userId, and optional metadata.
 * @param action - The action performed (e.g., "login", "delete").
 * @param resource - The resource affected (e.g., "user", "document").
 * @param userId - (Optional) The user ID who performed the action.
 * @param metadata - (Optional) Additional metadata to include in the log.
 */
export const logAudit = (
  action: string,
  resource: string,
  userId?: string,
  metadata?: Record<string, any>
) => {
  logger.info('AUDIT', {
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
export const logSecurity = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details?: Record<string, any>
) => {
  logger.warn('SECURITY', {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

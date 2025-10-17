import winston from 'winston';
import { config } from '@/config';

// Define log format for production (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(info => {
    const { level, message, stack, timestamp, ...extra } = info;
    const logEntry: Record<string, unknown> = {
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
// Check NODE_ENV directly from environment at runtime, not from config
// This ensures we get the correct format even when Mastra builds the code
const isProduction =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV === undefined && config.nodeEnv === 'production');

const consoleTransport = new winston.transports.Console({
  format: isProduction ? productionFormat : developmentFormat,
});

// Create the logger instance
const transports: winston.transport[] = [consoleTransport];

/**
 * Sage logger instance
 */
const loggerInstance = winston.createLogger({
  level: config.logging.logLevel,
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

export default loggerInstance;

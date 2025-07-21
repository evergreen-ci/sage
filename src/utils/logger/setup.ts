import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../../config';

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

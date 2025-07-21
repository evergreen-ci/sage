import { MastraError } from '@mastra/core/error';
import { MastraLogger, LogLevel } from '@mastra/core/logger';
import { logger as customLogger } from '.';

/**
 * WinstonMastraLogger is a wrapper around the Winston logger that implements the MastraLogger interface.
 * It is used to log messages to the Winston logger.
 */
export class WinstonMastraLogger extends MastraLogger {
  constructor(options?: { name?: string; level?: LogLevel }) {
    super(options);
  }

  debug(message: string, ...args: any[]): void {
    customLogger.debug(message, ...args);
  }

  info(message: string, ...args: any[]): void {
    customLogger.info(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    customLogger.warn(message, ...args);
  }

  error(message: string, ...args: any[]): void {
    customLogger.error(message, ...args);
  }

  override trackException(error: MastraError): void {
    customLogger.error('Exception tracked', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      metadata: error.details,
    });
  }
}

import { MastraError } from '@mastra/core/error';
import { MastraLogger, LogLevel } from '@mastra/core/logger';
import loggerInstance from './setup';

/**
 * WinstonMastraLogger is a wrapper around the Winston logger that implements the MastraLogger interface.
 * It is used to log messages to the Winston logger.
 */
export class WinstonMastraLogger extends MastraLogger {
  constructor(options?: { name?: string; level?: LogLevel }) {
    super(options);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(message: string, ...args: any[]): void {
    loggerInstance.debug(message, ...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(message: string, ...args: any[]): void {
    loggerInstance.info(message, ...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(message: string, ...args: any[]): void {
    loggerInstance.warn(message, ...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(message: string, ...args: any[]): void {
    loggerInstance.error(message, ...args);
  }

  override trackException(error: MastraError): void {
    loggerInstance.error('Exception tracked', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      metadata: error.details,
    });
  }
}

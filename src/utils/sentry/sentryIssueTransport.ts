import * as Sentry from '@sentry/node';
import Transport from 'winston-transport';

class SentryIssueTransport extends Transport {
  log(info: Record<string, unknown>, callback: () => void) {
    setImmediate(() => this.emit('logged', info));

    const { err, error, level, message, ...extra } = info;

    // Only create Issues for error-level logs
    if (level === 'error') {
      // Try to find a real Error object to capture
      let throwable = null;
      if (error instanceof Error) {
        throwable = error;
      } else if (err instanceof Error) {
        throwable = err;
      }

      if (throwable) {
        Sentry.captureException(throwable, {
          extra: {
            message,
            ...extra,
          },
        });
      } else {
        // Fall back to a message-based error
        Sentry.captureMessage(
          typeof message === 'string' ? message : JSON.stringify(message),
          {
            level: 'error',
            extra,
          }
        );
      }
    }

    callback();
  }
}
export default SentryIssueTransport;

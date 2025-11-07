import * as Sentry from '@sentry/node';
import { config, logPrefixesToOmit } from '@/config';

// Global type declaration for hot reload persistence
declare global {
  var __SENTRY_INITIALIZED__: boolean | undefined;
}

/**
 * Initialize Sentry BEFORE any other imports
 * This must be the first import in the application to ensure proper instrumentation
 */

// Guard against multiple initializations during hot reload (e.g., with vite-node)
// This prevents EventEmitter memory leaks from accumulated child process listeners
// Use globalThis to persist flag across module reloads

if (
  config.sentry.enabled &&
  config.sentry.dsn &&
  !globalThis.__SENTRY_INITIALIZED__
) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    release: config.version,
    debug: config.sentry.debug,

    // Performance monitoring
    tracesSampleRate: config.sentry.tracesSampleRate,

    // Error tracking
    sampleRate: config.sentry.sampleRate,
    attachStacktrace: config.sentry.attachStacktrace,
    sendDefaultPii: true,

    // Enable logs for console logging integration (experimental)
    enableLogs: config.sentry.captureConsole,

    // Integrations - Sentry will auto-detect Express, HTTP, MongoDB, etc.
    // Note: Sentry automatically integrates with OpenTelemetry when both are initialized
    integrations: [
      // Express integration (auto-instruments all routes)
      Sentry.expressIntegration(),

      // HTTP client and server tracing
      Sentry.httpIntegration(),

      // MongoDB query tracing
      Sentry.mongoIntegration(),

      // Unhandled promise rejections
      Sentry.onUnhandledRejectionIntegration({
        mode: 'warn',
      }),

      // Console logging integration - captures console.log/error/warn as Sentry logs
      // Requires enableLogs: true above (experimental feature)
      ...(config.sentry.captureConsole
        ? [
            Sentry.consoleLoggingIntegration({
              levels: ['error', 'warn', 'log'], // Customize which levels to capture
            }),
          ]
        : []),
    ],
    beforeSendLog(log) {
      if (logPrefixesToOmit.some(prefix => log.message.startsWith(prefix))) {
        return null;
      }
      return log;
    },

    // Hooks for debugging
    beforeSend: event => {
      if (config.nodeEnv === 'development') {
        console.debug('Sentry event:', event);
      }
      return event;
    },

    beforeSendTransaction: transaction => {
      if (config.nodeEnv === 'development') {
        console.debug('Sentry transaction:', transaction);
      }
      return transaction;
    },
  });

  globalThis.__SENTRY_INITIALIZED__ = true;

  console.log('Sentry initialized successfully', {
    environment: config.sentry.environment,
    release: config.version,
    sampleRate: config.sentry.sampleRate,
    tracesSampleRate: config.sentry.tracesSampleRate,
  });
} else if (!config.sentry.enabled || !config.sentry.dsn) {
  console.log('Sentry is disabled or DSN not configured');
}

import * as Sentry from '@sentry/node';
import '@sentry/profiling-node';
import { config, logPrefixesToOmit } from '@/config';

/**
 * Initialize Sentry BEFORE any other imports
 * This must be the first import in the application to ensure proper instrumentation
 */
if (config.sentry.enabled && config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    debug: config.sentry.debug,

    // Performance monitoring
    tracesSampleRate: config.sentry.tracesSampleRate,
    profilesSampleRate: config.sentry.profilesSampleRate,

    // Error tracking
    sampleRate: config.sentry.sampleRate,
    attachStacktrace: config.sentry.attachStacktrace,
    sendDefaultPii: true,

    // Enable logs for console logging integration (experimental)
    enableLogs: config.sentry.captureConsole,

    // Integrations - Sentry will auto-detect Express, HTTP, MongoDB, etc.
    // Note: Sentry automatically integrates with OpenTelemetry when both are initialized
    // Performance profiling is enabled automatically via @sentry/profiling-node import
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

  console.log('Sentry initialized successfully', {
    environment: config.nodeEnv,
    sampleRate: config.sentry.sampleRate,
    tracesSampleRate: config.sentry.tracesSampleRate,
    profilesSampleRate: config.sentry.profilesSampleRate,
  });
} else {
  console.log('Sentry is disabled or DSN not configured');
}

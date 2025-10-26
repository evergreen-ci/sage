import * as Sentry from '@sentry/node';
import '@sentry/profiling-node';
import { config } from '@/config';

/**
 * Initialize Sentry BEFORE any other imports
 * This must be the first import in the application to ensure proper instrumentation
 */
if (config.sentry.enabled && config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.nodeEnv,
    debug: config.sentry.debug,

    // Performance monitoring
    tracesSampleRate: config.sentry.tracesSampleRate,
    profilesSampleRate: config.sentry.profilesSampleRate,

    // Error tracking
    sampleRate: config.sentry.sampleRate,
    attachStacktrace: config.sentry.attachStacktrace,
    sendDefaultPii: true,

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

      // Optional: Console integration
      ...(config.sentry.captureConsole ? [Sentry.consoleIntegration()] : []),
    ],

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
    enableLogs: config.sentry.captureConsole,
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

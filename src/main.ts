// IMPORTANT: OpenTelemetry instrumentation MUST be imported FIRST before any other modules
// This allows it to monkey-patch HTTP, Express, MongoDB, etc. before they are loaded
// eslint-disable-next-line import/order
import { shutdownOtel } from '@/instrumentation';
import './sentry-instrument';

import server from '@/api-server';
import { validateConfig } from '@/config';
import { sentryService } from '@/utils/sentry';

// Validate configuration on startup
validateConfig();

server.start();

// Graceful shutdown configuration
const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

/**
 * Gracefully shutdown the application with timeout protection
 * @param signal - The signal that triggered the shutdown (e.g., 'SIGINT', 'SIGTERM')
 */
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);

  // Force exit if graceful shutdown takes too long
  const forceExitTimer = setTimeout(() => {
    console.error(
      `Graceful shutdown timeout (${SHUTDOWN_TIMEOUT}ms) exceeded, forcing exit`
    );
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // Run all shutdown operations with a timeout
    await Promise.race([
      (async () => {
        await server.stop();
        await sentryService.close();
        await shutdownOtel();
      })(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Shutdown operations timeout')),
          SHUTDOWN_TIMEOUT
        )
      ),
    ]);

    clearTimeout(forceExitTimer);
    console.log('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Gracefully shutdown the server
// Prevent duplicate listeners during hot reload
const hasSignalListeners = process.listenerCount('SIGINT') > 0;

if (!hasSignalListeners) {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

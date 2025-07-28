import server from 'api-server';
import { validateConfig } from 'config';
import { tracing } from 'utils/tracing';

// Validate configuration on startup
validateConfig();

// Initialize OpenTelemetry tracing
tracing.init();

// Start the server
server.start();

// Gracefully shutdown the server
process.on('SIGINT', async () => {
  await server.stop();
  await tracing.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  await tracing.shutdown();
  process.exit(0);
});

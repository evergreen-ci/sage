// IMPORTANT: Instrumentation must be imported FIRST to properly instrument the application
// eslint-disable-next-line import/order
import { shutdownOtel } from '@/instrumentation';
import './instrumentation';
import './sentry-instrument';
import server from '@/api-server';
import { validateConfig } from '@/config';
import { sentryService } from '@/utils/sentry';

// Validate configuration on startup
validateConfig();

server.start();

// Gracefully shutdown the server
process.on('SIGINT', async () => {
  await server.stop();
  await sentryService.close();
  await shutdownOtel();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  await sentryService.close();
  await shutdownOtel();
  process.exit(0);
});

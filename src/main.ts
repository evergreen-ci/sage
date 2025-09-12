import './instrumentation';
import server from 'api-server';
import { validateConfig } from 'config';
import { sentryService } from './utils/sentry';

// Validate configuration on startup
validateConfig();

sentryService.initialize();
server.start();

// Gracefully shutdown the server
process.on('SIGINT', async () => {
  await server.stop();
  await sentryService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  await sentryService.close();
  process.exit(0);
});

import './tracing';
import server from 'api-server';
import { validateConfig } from 'config';

// Validate configuration on startup
validateConfig();

server.start();

// Gracefully shutdown the server
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});

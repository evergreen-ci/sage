import { validateConfig } from './config';
import server from './server';

// Validate configuration on startup
validateConfig();

server.start();

// Gracefully shutdown the server
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

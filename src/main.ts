import server from './api-server';
import { validateConfig } from './config';



// Add error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

try {
  // Validate configuration on startup
  console.log('Validating config...');
  validateConfig();

  console.log('Starting server...');
  server.start();
  console.log('Server.start() called successfully');
} catch (error) {
  console.error('Error during startup:', error);
  process.exit(1);
}

// Gracefully shutdown the server
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});

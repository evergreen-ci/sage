import { config } from 'config';
import express, { Application } from 'express';
import { logInfo, logError, logWarn } from 'utils/logger';
import {
  requestIdMiddleware,
  httpLoggingMiddleware,
  errorLoggingMiddleware,
} from './middlewares/logging';
import parsleyCompletionsRoute from './routes/completions/parsley';
import healthRoute from './routes/health';
import rootRoute from './routes/root';

/**
 * `startServer` is a function that starts the server.
 */
class SageServer {
  private app: Application;
  private serverInstance: ReturnType<Application['listen']> | null = null;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware() {
    // Request ID middleware (must be first)
    this.app.use(requestIdMiddleware);

    // HTTP logging middleware
    this.app.use(httpLoggingMiddleware);

    // Basic Express middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    this.app.get('/', rootRoute);
    this.app.get('/health', healthRoute);
    this.app.post('/completions/parsley', parsleyCompletionsRoute);
  }

  private setupErrorHandling() {
    // Error logging middleware (must be after routes)
    this.app.use(errorLoggingMiddleware);
  }

  public start() {
    if (this.serverInstance) {
      console.warn('Server is already running.');
      return;
    }

    logInfo('Starting Sage server', {
      port: config.port,
      nodeEnv: config.nodeEnv,
    });

    this.serverInstance = this.app.listen(config.port, () => {
      logInfo(`🚀 Sage server is running on port ${config.port}`);
      logInfo(
        `📡 Health check available at http://localhost:${config.port}/health`
      );
    });
  }

  public async stop(): Promise<void> {
    if (!this.serverInstance) {
      logWarn('Server is not running.');
      return;
    }

    logInfo('Stopping Sage server');

    await new Promise<void>((resolve, reject) => {
      this.serverInstance!.close((err?: Error) => {
        if (err) {
          logError('Error stopping server', err);
          reject(err);
        } else {
          logInfo('🛑 Sage server has been stopped');
          resolve();
        }
      });
    });
    this.serverInstance = null;
  }

  public getApp(): Application {
    return this.app;
  }
}

export default new SageServer();

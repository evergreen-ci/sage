import express, { Application } from 'express';
import expressListEndpoints from 'express-list-endpoints';
import { config } from 'config';
import { logger } from 'utils/logger';
import {
  requestIdMiddleware,
  httpLoggingMiddleware,
  errorLoggingMiddleware,
  requestTracingMiddleware,
} from './middlewares';
import { completionsRoute } from './routes';
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
    
    // Tracing middleware (adds span attributes)
    this.app.use(requestTracingMiddleware);

    // Basic Express middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    this.app.get('/', rootRoute);
    this.app.get('/health', healthRoute);
    this.app.use('/completions', completionsRoute);
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

    logger.info('Starting Sage server', {
      port: config.port,
      nodeEnv: config.nodeEnv,
    });

    this.serverInstance = this.app.listen(config.port, () => {
      logger.info(`🚀 Sage server is running on port ${config.port}`);
      const routes = expressListEndpoints(this.app);
      logger.info('Available routes:');
      routes.forEach(route => {
        logger.info(`${route.methods.join(', ')} ${route.path}`);
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.serverInstance) {
      logger.warn('Server is not running.');
      return;
    }

    logger.info('Stopping Sage server');

    await new Promise<void>((resolve, reject) => {
      this.serverInstance!.close((err?: Error) => {
        if (err) {
          logger.error('Error stopping server', err);
          reject(err);
        } else {
          logger.info('🛑 Sage server has been stopped');
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

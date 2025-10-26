import * as Sentry from '@sentry/node';
import cors from 'cors';
import express, { Application } from 'express';
import expressListEndpoints from 'express-list-endpoints';
import { userIdMiddleware } from '@/api-server/middlewares/authentication';
import { completionsRoute, loginRoute } from '@/api-server/routes';
import healthRoute from '@/api-server/routes/health';
import rootRoute from '@/api-server/routes/root';
import { config } from '@/config';
import { db } from '@/db/connection';
import { logger } from '@/utils/logger';
import {
  requestIdMiddleware,
  httpLoggingMiddleware,
  errorLoggingMiddleware,
} from './middlewares/logging';

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
    // Middleware to add the request id to the request
    this.app.use(requestIdMiddleware);
    // Middleware to add the authenticated user id to the request trace
    this.app.use(userIdMiddleware);

    // HTTP logging middleware
    this.app.use(httpLoggingMiddleware);

    // Basic Express middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use(
      cors({
        origin: true,
        credentials: true,
      })
    );
  }

  private setupRoutes() {
    this.app.get('/', rootRoute);
    this.app.get('/health', healthRoute);
    this.app.use('/completions', completionsRoute);
    this.app.use('/login', loginRoute);
  }

  private setupErrorHandling() {
    // Error logging middleware (must be after routes)
    this.app.use(errorLoggingMiddleware);

    // Sentry error handler - MUST be after all routes and other error handlers
    // This is automatically configured by Sentry's Express integration
    Sentry.setupExpressErrorHandler(this.app);
  }

  public async start() {
    if (this.serverInstance) {
      console.warn('Server is already running.');
      return;
    }

    logger.info('Starting Sage server', {
      port: config.port,
      nodeEnv: config.nodeEnv,
      downstreamEvergreenURL: config.evergreen.evergreenURL,
    });

    await db.connect();

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

    await db.disconnect();

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

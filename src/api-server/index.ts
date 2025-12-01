import type { Server as HttpServer } from 'http';
import type { Socket } from 'net';
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
import { sentryUserContextMiddleware } from './middlewares/sentryContext';

// Global type declaration for hot reload persistence
declare global {
  var __SAGE_SERVER_INSTANCE__: SageServer | undefined;
}

/**
 * `startServer` is a function that starts the server.
 */
class SageServer {
  private app: Application;
  private serverInstance: HttpServer | null = null;
  private startTime: Date | null = null;
  private connections = new Set<Socket>();
  private allConnectionsClosed: (() => void) | null = null;

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
    // Middleware to set Sentry user context from authenticated user
    this.app.use(sentryUserContextMiddleware);

    // HTTP logging middleware
    this.app.use(httpLoggingMiddleware);

    // Basic Express middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use(
      cors({
        origin: true,
        credentials: true,
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'User-Agent',
          'x-authenticated-sage-user',
          'x-kanopy-internal-authorization',
        ],
      })
    );

    if (config.sentry.enabled) {
      Sentry.setupExpressErrorHandler(this.app);
    }
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

    if (config.sentry.enabled) {
      Sentry.setupExpressErrorHandler(this.app);
    }
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

    this.startTime = new Date();

    this.serverInstance = this.app.listen(config.port, () => {
      logger.info(`🚀 Sage server is running on port ${config.port}`);
      const routes = expressListEndpoints(this.app);
      logger.info('Available routes:');
      routes.forEach(route => {
        logger.info(`${route.methods.join(', ')} ${route.path}`);
      });
    });

    // Track active connections for graceful shutdown
    this.serverInstance.on('connection', (socket: Socket) => {
      this.connections.add(socket);
      socket.on('close', () => {
        this.connections.delete(socket);
        // Notify if we're waiting for all connections to close
        if (this.connections.size === 0 && this.allConnectionsClosed) {
          this.allConnectionsClosed();
          this.allConnectionsClosed = null;
        }
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.serverInstance) {
      logger.warn('Server is not running.');
      return;
    }

    logger.info('Stopping Sage server');

    // Disconnect from database first
    await db.disconnect();

    // Wait briefly for connections to close naturally
    const gracePeriod = 5000; // 5 seconds

    // Wait for connections to close or grace period to expire
    if (this.connections.size > 0) {
      await Promise.race([
        // Resolve immediately when all connections close
        new Promise<void>(resolve => {
          this.allConnectionsClosed = resolve;
        }),
        // Timeout after grace period
        new Promise<void>(resolve => setTimeout(() => resolve(), gracePeriod)),
      ]);
      // Clean up callback if it wasn't called
      this.allConnectionsClosed = null;
    }

    // Force close any remaining connections
    if (this.connections.size > 0) {
      logger.warn(
        `Forcefully closing ${this.connections.size} remaining connections`
      );
      for (const socket of this.connections) {
        socket.destroy();
      }
      this.connections.clear();
    }

    // Stop the HTTP server and wait for it to close
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
    this.startTime = null;
  }

  public getApp(): Application {
    return this.app;
  }

  public getUptimeSeconds(): number | null {
    if (!this.startTime) {
      return null;
    }
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }
}

// Singleton pattern to prevent multiple instances during hot reload (e.g., with vite-node)
// This prevents EventEmitter memory leaks from accumulated child process listeners
// Use globalThis to persist singleton across module reloads

/**
 * Gets the singleton SageServer instance.
 * Creates a new instance on first call, returns the same instance on subsequent calls.
 * This prevents multiple server instances during hot reload.
 * @returns The singleton SageServer instance
 */
function getSageServer(): SageServer {
  if (!globalThis.__SAGE_SERVER_INSTANCE__) {
    globalThis.__SAGE_SERVER_INSTANCE__ = new SageServer();
  }
  return globalThis.__SAGE_SERVER_INSTANCE__;
}

export default getSageServer();

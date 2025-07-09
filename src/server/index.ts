import { config } from 'config';
import express, { Application } from 'express';
import parsleyCompletionsRoute from './routes/completions/parsley';
import healthRoute from './routes/health';
import rootRoute from './routes/root';

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', rootRoute);

// Health check endpoint
app.get('/health', healthRoute);

/**
 * `startServer` is a function that starts the server.
 */
class SageServer {
  private app: Application;
  private serverInstance: ReturnType<typeof app.listen> | null = null;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    this.app.get('/', rootRoute);
    this.app.get('/health', healthRoute);
    this.app.post('/completions/parsley', parsleyCompletionsRoute);
  }

  public start() {
    if (this.serverInstance) {
      console.warn('Server is already running.');
      return;
    }
    this.serverInstance = this.app.listen(config.port, () => {
      console.log(`🚀 Sage server is running on port ${config.port}`);
      console.log(
        `📡 Health check available at http://localhost:${config.port}/health`
      );
    });
  }

  public async stop(): Promise<void> {
    if (!this.serverInstance) {
      console.warn('Server is not running.');
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.serverInstance!.close((err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log('🛑 Sage server has been stopped.');
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

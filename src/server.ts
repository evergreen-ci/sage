import express, { Request, Response, Application } from 'express';
import { config, validateConfig } from './config';

// Validate configuration on startup
validateConfig();

const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to Sage - Evergreen AI Service',
    version: '1.0.0',
    status: 'running',
    environment: config.nodeEnv
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0'
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`🚀 Sage server is running on port ${config.port}`);
  console.log(`📡 Health check available at http://localhost:${config.port}/health`);
});

export default app; 

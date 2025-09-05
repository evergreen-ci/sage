import { Request, Response, NextFunction } from 'express';
import expressWinston from 'express-winston';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import loggerInstance, { logger } from 'utils/logger';

// Extend Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

/**
 * Middleware to add request ID to all requests
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);

  next();
};

/**
 * Express-winston middleware for HTTP request logging
 */
export const httpLoggingMiddleware = expressWinston.logger({
  winstonInstance: loggerInstance,
  meta: true,
  msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}}',
  expressFormat: false,
  colorize: false,
  format: winston.format.json(),
  dynamicMeta: (req: Request, res: Response) => ({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.socket.remoteAddress,
    contentLength: res.get('Content-Length'),
    contentType: res.get('Content-Type'),
    duration: res.get('responseTime'),
    userId: req.get('userId'),
  }),
});

/**
 * Express-winston middleware for error logging
 */
export const errorLoggingMiddleware = expressWinston.errorLogger({
  winstonInstance: loggerInstance,
  meta: true,
  msg: 'HTTP Error {{req.method}} {{req.url}} {{res.statusCode}}',
  dynamicMeta: (req: Request, res: Response) => ({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    body: req.body,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.socket.remoteAddress,
    statusCode: res.statusCode,
  }),
});

/**
 * Middleware to log slow requests
 * @param threshold - Threshold in milliseconds
 * @returns Middleware function
 */
export const slowRequestMiddleware =
  (threshold: number = 1000) =>
  (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Use res.on('finish') instead of overriding res.end
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;

      if (responseTime > threshold) {
        logger.warn('Slow Request Detected', {
          requestId: req.requestId,
          method: req.method,
          url: req.url,
          responseTime,
          threshold,
        });
      }
    });

    next();
  };

/**
 * @param req - Express request object
 * @returns Logger instance with request context
 */
export const getRequestLogger = (req: Request) =>
  loggerInstance.child({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
  });

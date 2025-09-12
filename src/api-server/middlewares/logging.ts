import { context, trace } from '@opentelemetry/api';
import { Request, Response, NextFunction } from 'express';
import expressWinston from 'express-winston';
import { v4 as uuidv4 } from 'uuid';
import loggerInstance, { logger } from 'utils/logger';

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
  res.locals.requestId = uuidv4();
  res.locals.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', res.locals.requestId);
  const span = trace.getSpan(context.active());
  if (span) {
    span.setAttribute('request.id', res.locals.requestId);
  }
  next();
};

/**
 * Express-winston middleware for HTTP request logging
 */
export const httpLoggingMiddleware = expressWinston.logger({
  winstonInstance: loggerInstance,
  meta: false,
  msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
  expressFormat: false,
  colorize: false,
  dynamicMeta: (req: Request, res: Response) => ({
    requestId: res.locals.requestId,
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.socket.remoteAddress,
    contentLength: res.get('Content-Length'),
    contentType: res.get('Content-Type'),
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
    requestId: res.locals.requestId,
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
          requestId: res.locals.requestId,
          method: req.method,
          url: req.url,
          responseTime,
          threshold,
        });
      }
    });

    next();
  };

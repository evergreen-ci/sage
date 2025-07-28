import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

// Note: Request type is extended in logging.ts with requestId and startTime
// This is needed for TypeScript to recognize the properties
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

/**
 * Middleware to add custom attributes to the current span for request context
 * This enriches the OpenTelemetry spans with additional information from the request
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const requestTracingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get the current active span
    const currentSpan = trace.getActiveSpan();
    
    // Debug logging
    logger.debug('Trace middleware executed', {
      hasActiveSpan: !!currentSpan,
      path: req.path,
      method: req.method,
      requestId: req.requestId
    });

    if (currentSpan) {
      // Add request-specific attributes to the span
      currentSpan.setAttributes({
        'http.request_id': req.requestId,
        'http.user_agent': req.get('User-Agent') || 'unknown',
        'http.client_ip': req.ip || req.socket.remoteAddress || 'unknown',
        'http.route': req.route?.path || req.path,
      });

      // If there's a content-type, add it as an attribute
      const contentType = req.get('Content-Type');
      if (contentType) {
        currentSpan.setAttribute('http.request.content_type', contentType);
      }

      // Add any path parameters to the span
      if (req.params && Object.keys(req.params).length > 0) {
        // Avoid adding sensitive parameter values directly
        currentSpan.setAttribute(
          'http.route.params',
          JSON.stringify(Object.keys(req.params))
        );
      }

      // Store response metrics when the response is sent
      res.on('finish', () => {
        // Add response attributes to the span
        currentSpan.setAttributes({
          'http.response.size': parseInt(res.get('Content-Length') || '0', 10),
          'http.response.content_type': res.get('Content-Type') || 'unknown',
          'http.status_code': res.statusCode,
        });

        // Set status based on the HTTP status code
        if (res.statusCode >= 400) {
          currentSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP Error ${res.statusCode}`,
          });
        }

        // Calculate response time
        const responseTime = Date.now() - req.startTime;
        currentSpan.setAttribute('http.response.duration_ms', responseTime);
      });
    }
  } catch (error) {
    logger.error('Error in tracing middleware', error);
  }

  next();
};

/**
 * Creates a custom span for a specific operation
 * @param name - Name of the span
 * @param fn - Function to execute within the span
 * @param attributes - Optional attributes to add to the span
 * @returns The result of the function execution
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = trace.getTracer('sage-service');
  
  // Console log for debugging
  console.log('Creating custom span:', name, attributes);

  return tracer.startActiveSpan(name, async span => {
    try {
      // Add custom attributes if provided
      if (attributes) {
        span.setAttributes(attributes);
      }

      // Execute the function
      const result = await fn();

      // End the span
      span.end();

      return result;
    } catch (error) {
      // Record error and end the span
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error)?.message || 'Unknown error',
      });
      span.end();

      // Re-throw the error
      throw error;
    }
  });
}


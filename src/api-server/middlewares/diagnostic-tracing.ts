import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * Middleware that ensures a span is created for every request
 * This is a backup in case auto-instrumentation isn't working
 */
export const diagnosticTracingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get the OpenTelemetry tracer
  const tracer = trace.getTracer('diagnostic-tracer');
  
  // Check if there's already an active span from auto-instrumentation
  const existingSpan = trace.getActiveSpan();
  
  // Log the current span status
  logger.debug('Diagnostic tracing middleware executed', {
    hasActiveSpan: !!existingSpan,
    path: req.path,
    method: req.method,
    requestId: req.requestId
  });
  
  // If no active span, create one to ensure tracing works
  if (!existingSpan) {
    logger.info('No active span detected, creating a diagnostic span', {
      requestId: req.requestId,
      path: req.path
    });
    
    // Create a span for this request
    const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.path': req.path,
        'http.request_id': req.requestId,
        'http.route': req.route?.path || req.path,
        'diagnostic': true
      }
    });
    
    // Execute the request in the context of our new span
    context.with(trace.setSpan(context.active(), span), () => {
      // Add response handler
      const originalEnd = res.end;
      
      // Store the start time
      const startTime = Date.now();
      
      // Handle response completion
      res.on('finish', () => {
        // Add response data to span
        span.setAttributes({
          'http.status_code': res.statusCode,
          'http.response_duration_ms': Date.now() - startTime,
        });
        
        // Set span status based on response code
        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP Error ${res.statusCode}`
          });
        }
        
        // End the span
        span.end();
        
        logger.debug('Diagnostic span completed', {
          requestId: req.requestId,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Date.now() - startTime
        });
      });
      
      // Continue with request processing
      next();
    });
  } else {
    // We have an active span, just continue
    next();
  }
};
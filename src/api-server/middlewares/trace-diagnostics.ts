import { context, trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to diagnose trace context issues and create spans as needed
 */
export const traceDiagnosticsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Get the OpenTelemetry tracer
  const tracer = trace.getTracer('express-diagnostics');
  
  // Always create a valid span for this request if one doesn't exist
  const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.path': req.path,
      'http.request_id': req.requestId,
    }
  });
  
  // Log diagnostics
  console.log(`[Trace Diagnostics] Created diagnostic span for ${req.method} ${req.path}`);
  console.log('[Trace Diagnostics] Active span exists:', !!trace.getActiveSpan());
  
  // Execute the request within the context of our span
  context.with(trace.setSpan(context.active(), span), () => {
    // Store start time for calculating duration
    const startTime = Date.now();
    
    // Continue processing the request
    next();
    
    // Add response handler
    res.on('finish', () => {
      // Add response attributes
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_time_ms': Date.now() - startTime,
      });
      
      // Set status based on response
      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP Error ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
      
      // End the span
      span.end();
      console.log(`[Trace Diagnostics] Completed span for ${req.method} ${req.path} with status ${res.statusCode}`);
    });
  });
};
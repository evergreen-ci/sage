import { Request, Response, NextFunction } from 'express';
import { sentryService } from '@/utils/sentry';

/**
 * Middleware to enrich Sentry scope with request context
 * @param req - Express request object with context
 * @param res - Express response object
 * @param next - Express next function
 * @returns void
 */
export const sentryContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!sentryService.isInitialized()) {
    return next();
  }

  sentryService.configureScope(scope => {
    if (res.locals.requestId) {
      scope.setTag('request_id', res.locals.requestId);
      scope.setContext('request', {
        id: res.locals.requestId,
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        headers: req.headers,
      });
    }

    if (res.locals.userId) {
      scope.setUser({
        id: res.locals.userId,
        ip_address: req.ip || null,
      });
      scope.setTag('user_id', res.locals.userId);
    }

    scope.setTag('http.method', req.method);
    scope.setTag('http.url', req.url);
    scope.setTag('http.path', req.path);

    sentryService.addBreadcrumb({
      category: 'http',
      message: `${req.method} ${req.path}`,
      level: 'info',
      data: {
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        requestId: res.locals.requestId,
      },
    });
  });

  next();
};

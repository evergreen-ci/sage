import { Request, Response, NextFunction } from 'express';
import { sentryService } from '../../utils/sentry';
import { getUserIdFromRequest } from './authentication';

export interface RequestWithContext {
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * Middleware to enrich Sentry scope with request context
 * @param req - Express request object with context
 * @param res - Express response object
 * @param next - Express next function
 * @returns void
 */
export const sentryContextMiddleware = (
  req: Request & RequestWithContext,
  res: Response,
  next: NextFunction
): void => {
  if (!sentryService.isInitialized()) {
    return next();
  }

  sentryService.configureScope(scope => {
    if (req.requestId) {
      scope.setTag('request_id', req.requestId);
      scope.setContext('request', {
        id: req.requestId,
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        headers: req.headers,
      });
    }

    const authenticatedUserId = getUserIdFromRequest(req);
    if (authenticatedUserId) {
      scope.setUser({
        id: authenticatedUserId,
        ip_address: req.ip || null,
      });
      scope.setTag('user_id', authenticatedUserId);
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
        requestId: req.requestId,
      },
    });
  });

  next();
};

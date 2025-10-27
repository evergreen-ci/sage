import * as Sentry from '@sentry/node';
import express from 'express';

/**
 * Middleware to set Sentry user context from authenticated user
 * This ensures all Sentry errors include user information for better debugging
 *
 * Must run after userIdMiddleware which sets res.locals.userId
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const sentryUserContextMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // Set user context if available
  if (res.locals.userId) {
    Sentry.setUser({
      username: res.locals.userId,
      email: `${res.locals.userId}@mongodb.com`,
      ip_address: req.ip,
    });
  }

  // Clean up user context after the request completes
  res.on('finish', () => {
    // Clear user context for the next request to avoid leaking user data
    Sentry.setUser(null);
  });

  next();
};

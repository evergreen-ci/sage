import { context, trace } from '@opentelemetry/api';
import express from 'express';
import { KANOPY_AUTH_HEADER } from '../../constants/headers';
import { logger } from '../../utils/logger';

interface KanopyJWTClaims {
  sub: string;
}

/**
 * @param authHeader - The authorization header string
 * @returns The user ID or null if extraction fails
 */
const extractUserIdFromKanopyHeader = (authHeader: string): string | null => {
  try {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split('.');
    if (parts.length !== 3) {
      logger.warn('Invalid JWT format');
      return null;
    }

    const encodedPayload = parts[1];
    if (!encodedPayload) {
      logger.warn('Missing payload in JWT');
      return null;
    }
    const decodedPayload = Buffer.from(encodedPayload, 'base64').toString(
      'utf-8'
    );
    const payload = JSON.parse(decodedPayload) as KanopyJWTClaims;

    return payload.sub || null;
  } catch (error) {
    logger.error('Failed to extract user ID from Kanopy header', { error });
    return null;
  }
};

/**
 * Extracts the user ID from the Kanopy authentication header in the request
 * @param req - The Express request object
 * @returns The user ID or null if no header is present or extraction fails
 */
const getUserIdFromRequest = (req: express.Request): string | null => {
  const kanopyAuthHeader = req.headers[KANOPY_AUTH_HEADER] as
    | string
    | undefined;

  if (!kanopyAuthHeader) {
    return process.env.USER_NAME || null;
  }
  return extractUserIdFromKanopyHeader(kanopyAuthHeader);
};

/**
 * Middleware to add the authenticated user id to the request trace
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const userIdMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authenticatedUserId = getUserIdFromRequest(req);
  if (!authenticatedUserId) {
    logger.error('No authentication provided', {
      requestId: res.locals.requestId,
    });
    res.status(401).json({ error: 'No authentication provided' });
    return;
  }
  const span = trace.getSpan(context.active());
  if (span) {
    span.setAttribute('user.id', authenticatedUserId);
  }
  res.locals.userId = authenticatedUserId;
  next();
};

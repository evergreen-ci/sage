import { context, trace } from '@opentelemetry/api';
import express from 'express';
import {
  KANOPY_AUTH_HEADER,
  EVERGREEN_USER_ID_HEADER,
  EVERGREEN_SPIFFE_IDENTITY,
} from '@/constants/headers';
import { logger } from '@/utils/logger';

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
 * Checks if the request is from Evergreen's service account.
 * Verifies by checking if the Kanopy JWT's subject matches Evergreen's SPIFFE identity.
 * @param req - The Express request object
 * @returns True if the caller is Evergreen's service account
 */
const isEvergreenServiceAccount = (req: express.Request): boolean => {
  const kanopyAuthHeader = req.headers[KANOPY_AUTH_HEADER] as
    | string
    | undefined;
  if (!kanopyAuthHeader) {
    return false;
  }

  const sub = extractUserIdFromKanopyHeader(kanopyAuthHeader);
  return sub === EVERGREEN_SPIFFE_IDENTITY;
};

/**
 * Authentication result containing the user ID and the authentication method used.
 */
interface AuthResult {
  userId: string | null;
  authMethod: 'evergreen-service' | 'kanopy-jwt' | 'local-dev' | null;
}

/**
 * Extracts the user ID from the request using the appropriate authentication method.
 * For backend-to-backend calls from Evergreen, uses the X-Evergreen-User-ID header.
 * For direct user calls, uses the Kanopy JWT authentication.
 * @param req - The Express request object
 * @returns AuthResult containing the user ID and authentication method
 */
const getUserFromRequest = (req: express.Request): AuthResult => {
  // Check for X-Evergreen-User-ID header
  const evergreenUserId = req.headers[EVERGREEN_USER_ID_HEADER] as
    | string
    | undefined;

  // Check if request is from Evergreen's service account (via Kanopy JWT subject)
  if (isEvergreenServiceAccount(req)) {
    if (evergreenUserId) {
      return {
        userId: evergreenUserId,
        authMethod: 'evergreen-service',
      };
    }

    // Evergreen service account but no user ID header - reject
    logger.warn(
      'Request from Evergreen service account missing X-Evergreen-User-ID header'
    );
    return { userId: null, authMethod: null };
  }

  // Use the existing Kanopy JWT authentication
  const kanopyAuthHeader = req.headers[KANOPY_AUTH_HEADER] as
    | string
    | undefined;

  if (!kanopyAuthHeader) {
    // Local development fallback
    if (process.env.USER_NAME) {
      return {
        userId: process.env.USER_NAME,
        authMethod: 'local-dev',
      };
    }
    return { userId: null, authMethod: null };
  }

  return {
    userId: extractUserIdFromKanopyHeader(kanopyAuthHeader),
    authMethod: 'kanopy-jwt',
  };
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
  const authResult = getUserFromRequest(req);
  if (!authResult.userId) {
    logger.error('No authentication provided', {
      requestId: res.locals.requestId,
    });
    res.status(401).json({ error: 'No authentication provided' });
    return;
  }

  // Log service-to-service authentication for audit purposes
  if (authResult.authMethod === 'evergreen-service') {
    logger.info('Service-to-service authentication from Evergreen', {
      requestId: res.locals.requestId,
      userId: authResult.userId,
      authMethod: authResult.authMethod,
      path: req.path,
    });
  }

  const span = trace.getSpan(context.active());
  if (span) {
    span.setAttribute('user.id', authResult.userId);
    if (authResult.authMethod) {
      span.setAttribute('auth.method', authResult.authMethod);
    }
  }
  res.locals.userId = authResult.userId;
  next();
};

import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface AuthenticatedRequest extends Request {
  userId?: string | undefined;
  isAuthenticated?: boolean | undefined;
}

interface KanopyJWTClaims {
  sub: string;
}

/**
 * Extract and validate the Kanopy Internal Authorization header
 * This header contains a JWT that has been validated by CorpSecure at the edge
 * @param req - The Express request object
 * @param res - The Express response object
 * @param next - The Express next function
 * @returns Promise resolving to void
 */
export async function authenticateKanopyToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const internalAuthHeader = req.headers[
      'x-kanopy-internal-authorization'
    ] as string;

    if (!internalAuthHeader) {
      logger.warn('Missing x-kanopy-internal-authorization header', {
        requestId: req.headers['x-request-id'],
        path: req.path,
      });
      req.isAuthenticated = false;
      return next();
    }

    const token = internalAuthHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      logger.warn('Empty authentication token', {
        requestId: req.headers['x-request-id'],
        path: req.path,
      });
      req.isAuthenticated = false;
      return next();
    }

    try {
      const jwksEndpoint =
        config.deploymentEnv === 'production'
          ? 'https://login.corp.mongodb.com/.well-known/jwks.json'
          : 'https://login.staging.corp.mongodb.com/.well-known/jwks.json';

      const JWKS = createRemoteJWKSet(new URL(jwksEndpoint));

      const { payload } = (await jwtVerify(token, JWKS, {
        issuer: 'login.corp.mongodb.com',
      })) as { payload: KanopyJWTClaims };

      req.userId = payload.sub;
      req.isAuthenticated = true;

      logger.debug('User authenticated via Kanopy token', {
        userId: req.userId,
        requestId: req.headers['x-request-id'],
      });

      next();
    } catch (jwtError) {
      logger.error('JWT validation failed', {
        error: jwtError,
        requestId: req.headers['x-request-id'],
        path: req.path,
      });
      req.isAuthenticated = false;
      return next();
    }
  } catch (error) {
    logger.error('Authentication middleware error', {
      error,
      requestId: req.headers['x-request-id'],
    });
    req.isAuthenticated = false;
    next();
  }
}

/**
 * Simple extraction of user ID from Kanopy header without full JWT validation
 * Use this when you trust that Kanopy has already validated the token
 * @param authHeader - The authorization header string
 * @returns The user ID or null if extraction fails
 */
export function extractUserIdFromKanopyHeader(
  authHeader: string
): string | null {
  try {
    if (!authHeader) {
      return null;
    }

    // Remove 'Bearer ' prefix if present
    const token = authHeader.replace(/^Bearer\s+/i, '');

    // Split JWT and decode payload (middle part)
    const parts = token.split('.');
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
}

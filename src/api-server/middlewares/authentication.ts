import { context, trace } from '@opentelemetry/api';
import express from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  KANOPY_AUTH_HEADER,
  EVERGREEN_USER_ID_HEADER,
  EVERGREEN_SPIFFE_IDENTITY,
} from '@/constants/headers';
import { config } from '@/config';
import { logger } from '@/utils/logger';

interface KanopyJWTClaims {
  sub: string;
}

// Module-level JWKS set, lazily initialized and cached for reuse across requests
let jwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;

const getJWKSet = (): ReturnType<typeof createRemoteJWKSet> | null => {
  const jwksUri = config.kanopy.jwksUri;
  if (!jwksUri) {
    return null;
  }
  if (!jwkSet) {
    jwkSet = createRemoteJWKSet(new URL(jwksUri));
  }
  return jwkSet;
};

/**
 * @param authHeader - The authorization header string
 * @returns The user ID or null if extraction or verification fails
 */
const extractUserIdFromKanopyHeader = async (
  authHeader: string
): Promise<string | null> => {
  try {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split('.');
    if (parts.length !== 3) {
      logger.warn('Invalid JWT format');
      return null;
    }

    const jwks = getJWKSet();

    if (jwks) {
      // Verify the JWT signature using the configured JWKS endpoint
      try {
        const { payload } = await jwtVerify(authHeader, jwks);
        return (payload as KanopyJWTClaims).sub || null;
      } catch (error) {
        logger.error('JWT signature verification failed', { error });
        return null;
      }
    }

    // KANOPY_JWKS_URI is not configured — fall back to unverified decode.
    // This is only safe in development/test environments where the proxy
    // layer is not present. In production, KANOPY_JWKS_URI must be set.
    if (config.nodeEnv === 'production' || config.nodeEnv === 'staging') {
      logger.error(
        'KANOPY_JWKS_URI is not configured in a production-like environment. ' +
          'Rejecting request to prevent unverified JWT acceptance.'
      );
      return null;
    }

    logger.warn(
      'JWT signature is NOT being verified — KANOPY_JWKS_URI is not set. ' +
        'This is only acceptable in local development or testing.'
    );

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
const getUserFromRequest = async (
  req: express.Request
): Promise<AuthResult> => {
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

  // Verify the JWT and extract the subject claim
  const sub = await extractUserIdFromKanopyHeader(kanopyAuthHeader);

  // Check for X-Evergreen-User-ID header
  const evergreenUserId = req.headers[EVERGREEN_USER_ID_HEADER] as
    | string
    | undefined;

  // Check if request is from Evergreen's service account (via verified Kanopy JWT subject)
  if (sub === EVERGREEN_SPIFFE_IDENTITY) {
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

  return {
    userId: sub,
    authMethod: 'kanopy-jwt',
  };
};

/**
 * Middleware to add the authenticated user id to the request trace
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const userIdMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authResult = await getUserFromRequest(req);
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

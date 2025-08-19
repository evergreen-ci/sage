import { Request } from 'express';
import { logger } from '../../utils/logger';

export interface AuthenticatedRequest extends Request {
  userId?: string | undefined;
  isAuthenticated?: boolean | undefined;
}

interface KanopyJWTClaims {
  sub: string;
}

/**
 * Simple extraction of user ID from Kanopy header without full JWT validation
 * Use this when you trust that Kanopy has already validated the internalAuthHeader
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
}

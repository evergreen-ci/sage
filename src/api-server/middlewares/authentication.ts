import { logger } from '../../utils/logger';

interface KanopyJWTClaims {
  sub: string;
}

/**
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

import { Request, Response } from 'express';
import { z } from 'zod';
import {
  upsertUserCredentials,
  deleteUserCredentials,
  findUserCredentialsByEmail,
} from '@/db/repositories/userCredentialsRepository';
import { logger } from '@/utils/logger';

const DEFAULT_EMAIL_DOMAIN = 'mongodb.com';

/**
 * Normalize a user identifier to a full email address
 * Kanopy JWT only provides username without domain, but Jira uses full emails
 * @param userId - The user ID (may be username only or full email)
 * @returns Full email address
 */
const normalizeToEmail = (userId: string): string => {
  if (userId.includes('@')) {
    return userId;
  }
  return `${userId}@${DEFAULT_EMAIL_DOMAIN}`;
};

// Response types
type GetKeyResponse =
  | { hasKey: false }
  | { hasKey: true; keyLastFour: string; createdAt: Date; updatedAt: Date };

type UpsertKeyResponse = { success: true; keyLastFour: string };
type DeleteKeyResponse = { success: true };
type ErrorResponse = { message: string; details?: unknown[] };

// Schema for cursor key request body
const cursorKeySchema = z.object({
  apiKey: z.string().trim().min(1, 'API key is required'),
});

/**
 * GET /pr-bot/user/cursor-key
 * Check if the user has a Cursor API key stored
 * @param req - Express request object
 * @param res - Express response object
 * @returns Response with key status
 */
export const getCursorKeyRoute = async (
  req: Request,
  res: Response<GetKeyResponse | ErrorResponse>
) => {
  const userId = res.locals.userId as string;
  const userEmail = normalizeToEmail(userId);
  const requestId = res.locals.requestId as string;

  try {
    const credentials = await findUserCredentialsByEmail(userEmail);

    if (!credentials) {
      return res.status(200).json({
        hasKey: false,
      });
    }

    return res.status(200).json({
      hasKey: true,
      keyLastFour: credentials.keyLastFour,
      createdAt: credentials.createdAt,
      updatedAt: credentials.updatedAt,
    });
  } catch (error) {
    logger.error('Failed to retrieve Cursor API key status', {
      requestId,
      userEmail,
      error,
    });
    return res.status(500).json({
      message: 'Failed to retrieve API key status',
    });
  }
};

/**
 * POST /pr-bot/user/cursor-key
 * Create or update the user's Cursor API key
 * @param req - Express request object
 * @param res - Express response object
 * @returns Response with success status and key last four digits
 */
export const upsertCursorKeyRoute = async (
  req: Request,
  res: Response<UpsertKeyResponse | ErrorResponse>
) => {
  const userId = res.locals.userId as string;
  const userEmail = normalizeToEmail(userId);
  const requestId = res.locals.requestId as string;

  const parseResult = cursorKeySchema.safeParse(req.body);
  if (!parseResult.success) {
    logger.warn('Invalid cursor-key request', {
      requestId,
      errors: parseResult.error.issues,
    });
    return res.status(400).json({
      message: 'Invalid request body',
      details: parseResult.error.issues,
    });
  }

  const { apiKey } = parseResult.data;

  try {
    logger.info('Storing Cursor API key for user', {
      requestId,
      userEmail,
    });

    const result = await upsertUserCredentials({
      email: userEmail,
      cursorApiKey: apiKey,
    });

    logger.info('Successfully stored Cursor API key', {
      requestId,
      userEmail,
      keyLastFour: result.keyLastFour,
    });

    return res.status(200).json({
      success: true,
      keyLastFour: result.keyLastFour,
    });
  } catch (error) {
    logger.error('Failed to store Cursor API key', {
      requestId,
      userEmail,
      error,
    });
    return res.status(500).json({
      message: 'Failed to store API key',
    });
  }
};

/**
 * DELETE /pr-bot/user/cursor-key
 * Remove the user's stored Cursor API key
 * @param req - Express request object
 * @param res - Express response object
 * @returns Response with success status
 */
export const deleteCursorKeyRoute = async (
  req: Request,
  res: Response<DeleteKeyResponse | ErrorResponse>
) => {
  const userId = res.locals.userId as string;
  const userEmail = normalizeToEmail(userId);
  const requestId = res.locals.requestId as string;

  try {
    logger.info('Deleting Cursor API key for user', {
      requestId,
      userEmail,
    });

    const deleted = await deleteUserCredentials(userEmail);

    if (!deleted) {
      logger.info('No Cursor API key found to delete', {
        requestId,
        userEmail,
      });
      return res.status(404).json({
        message: 'No API key found',
      });
    }

    logger.info('Successfully deleted Cursor API key', {
      requestId,
      userEmail,
    });

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    logger.error('Failed to delete Cursor API key', {
      requestId,
      userEmail,
      error,
    });
    return res.status(500).json({
      message: 'Failed to delete API key',
    });
  }
};

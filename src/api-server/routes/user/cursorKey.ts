import { Request, Response, Router } from 'express';
import { z } from 'zod';
import {
  upsertUserCredentials,
  deleteUserCredentials,
} from '@/db/repositories/userCredentialsRepository';
import { logger } from '@/utils/logger';

const router = Router();

// Schema for cursor key request body
const cursorKeySchema = z.object({
  apiKey: z.string().trim().min(1, 'API key is required'),
});

/**
 * POST /pr-bot/user/cursor-key
 * Create or update the user's Cursor API key
 */
router.post('/cursor-key', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const requestId = res.locals.requestId as string;

  const parseResult = cursorKeySchema.safeParse(req.body);
  if (!parseResult.success) {
    logger.warn('Invalid cursor-key request', {
      requestId,
      errors: parseResult.error.issues,
    });
    return res.status(400).json({
      error: 'Invalid request body',
      details: parseResult.error.issues,
    });
  }

  const { apiKey } = parseResult.data;

  try {
    logger.info('Storing Cursor API key for user', {
      requestId,
      userId,
    });

    await upsertUserCredentials({
      email: userId,
      cursorApiKey: apiKey,
    });

    const keyLastFour = apiKey.slice(-4);

    logger.info('Successfully stored Cursor API key', {
      requestId,
      userId,
      keyLastFour,
    });

    return res.status(200).json({
      success: true,
      keyLastFour,
    });
  } catch (error) {
    logger.error('Failed to store Cursor API key', {
      requestId,
      userId,
      error,
    });
    return res.status(500).json({
      error: 'Failed to store API key',
    });
  }
});

/**
 * DELETE /pr-bot/user/cursor-key
 * Remove the user's stored Cursor API key
 */
router.delete('/cursor-key', async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const requestId = res.locals.requestId as string;

  try {
    logger.info('Deleting Cursor API key for user', {
      requestId,
      userId,
    });

    const deleted = await deleteUserCredentials(userId);

    if (!deleted) {
      logger.info('No Cursor API key found to delete', {
        requestId,
        userId,
      });
      return res.status(404).json({
        error: 'No API key found',
      });
    }

    logger.info('Successfully deleted Cursor API key', {
      requestId,
      userId,
    });

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    logger.error('Failed to delete Cursor API key', {
      requestId,
      userId,
      error,
    });
    return res.status(500).json({
      error: 'Failed to delete API key',
    });
  }
});

export default router;

import { Request, Response } from 'express';
import { z } from 'zod';
import { config } from '@/config';
import { braintrustLogger } from '@/mastra';
import { resolveRowIdByTraceId } from '@/utils/braintrust';
import { logger } from '@/utils/logger';

export const addRatingInputSchema = z.object({
  spanId: z.string(),
  rating: z.union([z.literal(0), z.literal(1)]),
  feedback: z.string().optional(),
});

const rateMessageRoute = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  const {
    data: ratingData,
    error: schemaError,
    success: schemaSuccess,
  } = addRatingInputSchema.safeParse(req.body);
  if (!schemaSuccess) {
    logger.error('Invalid request body', {
      requestId: res.locals.requestId,
      body: req.body,
      error: schemaError,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  const { feedback, rating, spanId } = ratingData;
  let logRowId: string | undefined;
  try {
    logRowId = await resolveRowIdByTraceId(
      spanId,
      config.braintrust.projectId,
      config.braintrust.apiKey
    );
  } catch (error) {
    logger.error('Failed to resolve row ID for trace ID', {
      spanId,
      error,
    });
    return res.status(404).json({ error: 'Trace ID not found in Braintrust' });
  }

  if (!logRowId) {
    logger.error('Failed to resolve row ID for trace ID', {
      spanId,
    });
    return res.status(404).json({ error: 'Trace ID not found in Braintrust' });
  }

  try {
    logger.info('Logging feedback to Braintrust', {
      spanId,
      logRowId,
      rating,
      feedback,
    });
    braintrustLogger.logFeedback({
      id: logRowId,
      comment: feedback,
      scores: {
        correctness: rating,
      },
      source: 'external',
      metadata: {
        timestamp: new Date(),
        user_id: res.locals.userId,
      },
    });

    logger.info('Feedback logged to Braintrust', {
      spanId,
      rating,
      feedback,
    });
  } catch (braintrustError) {
    logger.error('Failed to log feedback to Braintrust', {
      error: braintrustError,
    });
    return res
      .status(503)
      .json({ error: 'Failed to log feedback to Braintrust' });
  }
  return res.status(204).send();
};

export default rateMessageRoute;

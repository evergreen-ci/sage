import { Request, Response } from 'express';
import z from 'zod';
import { braintrustLogger } from 'mastra';
import { logger } from 'utils/logger';

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
  try {
    braintrustLogger.logFeedback({
      id: spanId,
      comment: feedback,
      scores: {
        correctness: rating,
      },
      metadata: {
        timestamp: new Date(),
        user_id: res.locals.userId,
      },
    });

    logger.info('Feedback logged to Braintrust', {
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

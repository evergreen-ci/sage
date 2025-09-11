import { initLogger as initBraintrustLogger } from 'braintrust';
import { Request, Response } from 'express';
import z from 'zod';
import { logger } from 'utils/logger';
import { config } from '../../../../config';

export const addRatingInputSchema = z.object({
  messageId: z.string(),
  rating: z.union([z.literal(0), z.literal(1)]),
  feedback: z.string().optional(),
});

const braintrustLogger = initBraintrustLogger({
  projectName: config.braintrust.projectName,
  apiKey: config.braintrust.apiKey,
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
      requestId: req.requestId,
      body: req.body,
      error: schemaError,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  const score = ratingData.rating;
  const spanId = '???';
  try {
    braintrustLogger.logFeedback({
      id: spanId,
      scores: {
        correctness: score,
      },
      metadata: {
        timestamp: new Date(),
      },
    });

    logger.info('Feedback logged to Braintrust', {
      messageId: ratingData.messageId,
      score,
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

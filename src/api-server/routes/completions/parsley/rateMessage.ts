import { initLogger as initBraintrustLogger } from 'braintrust';
import { Request, Response } from 'express';
import { logger } from 'utils/logger';
import { config } from '../../../../config';

export interface MessageRating {
  rating: 0 | 1; // 0 for thumbs down, 1 for thumbs up
  feedback?: string;
  userId?: string;
  timestamp?: Date;
}

interface RateMessageRequest extends Request<{ messageId: string }> {
  body: MessageRating;
}

const braintrustLogger = initBraintrustLogger({
  projectName: config.braintrust.parent,
  apiKey: config.braintrust.apiKey,
});

const rateMessageRoute = async (
  req: RateMessageRequest,
  res: Response
): Promise<Response | void> => {
  const { messageId } = req.params;
  const messageRating = req.body;

  try {
    if (!messageId) {
      logger.warn('Missing messageId parameter in rating request');
      return res.status(400).json({ error: 'Missing messageId parameter' });
    }

    if (
      !messageRating ||
      messageRating.rating === undefined ||
      messageRating.rating === null
    ) {
      logger.warn('Invalid rating data', { messageId });
      return res.status(400).json({ error: 'Invalid rating data' });
    }

    if (messageRating.rating !== 0 && messageRating.rating !== 1) {
      logger.warn('Invalid rating value', {
        messageId,
        rating: messageRating.rating,
      });
      return res
        .status(400)
        .json({ error: 'Rating must be 0 (thumbs down) or 1 (thumbs up)' });
    }

    logger.info('Message rating received', {
      messageId,
      rating: messageRating.rating === 1 ? 'thumbs_up' : 'thumbs_down',
      hasFeedback: !!messageRating.feedback,
    });

    const score = messageRating.rating;
    try {
      braintrustLogger.logFeedback({
        id: messageId,
        scores: {
          user_rating: score,
        },
        comment: messageRating.feedback,
        metadata: {
          user_id: messageRating.userId,
          timestamp: messageRating.timestamp || new Date(),
          message_id: messageId,
        },
      });

      logger.info('Feedback logged to Braintrust', {
        messageId,
        score,
        userId: messageRating.userId,
      });
    } catch (braintrustError) {
      logger.error('Failed to log feedback to Braintrust', {
        error: braintrustError,
        messageId,
      });
    }

    return res.status(204).send();
  } catch (error) {
    logger.error('Error processing message rating', {
      error,
      messageId,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export default rateMessageRoute;

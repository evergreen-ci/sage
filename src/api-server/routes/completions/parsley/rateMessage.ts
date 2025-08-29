import { Request, Response } from 'express';
import { logger } from 'utils/logger';

export interface MessageRating {
  rating: number;
  feedback?: string;
  userId?: string;
  timestamp?: Date;
}

interface RateMessageRequest extends Request<{ messageId: string }> {
  body: MessageRating;
}

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

    if (!messageRating || typeof messageRating.rating !== 'number') {
      logger.warn('Invalid rating data', { messageId });
      return res.status(400).json({ error: 'Invalid rating data' });
    }

    if (messageRating.rating < 1 || messageRating.rating > 5) {
      logger.warn('Rating out of range', {
        messageId,
        rating: messageRating.rating,
      });
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    logger.info('Message rating received', {
      messageId,
      rating: messageRating.rating,
      hasFeedback: !!messageRating.feedback,
    });

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

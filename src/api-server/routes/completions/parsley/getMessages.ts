import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { logger } from 'utils/logger';

const getMessagesParamsSchema = z.object({
  conversationId: z.string().min(1),
});

type GetMessagesOutput = {
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
};

type ErrorResponse = {
  message: string;
};

const getMessagesRoute = async (req: Request, res: Response) => {
  logger.info('Get messages request received', {
    requestId: req.requestId,
    body: req.body,
  });

  const { data: paramsData, success: paramsSuccess } =
    getMessagesParamsSchema.safeParse(req.params);
  if (!paramsSuccess) {
    logger.error('Invalid request params', {
      requestId: req.requestId,
      params: req.params,
    });
    res.status(400).json({ message: 'Invalid request params' });
    return;
  }
  const { conversationId } = paramsData;

  try {
    const memory = await mastra.getMemory();
    const thread = await memory?.getThreadById({ threadId: conversationId });
    if (!thread) {
      logger.error('Thread not found', {
        requestId: req.requestId,
        conversationId,
      });
      res.status(404).json({ message: 'Thread not found' });
      return;
    }

    // const messages = await thread.getMessages();
    res.status(200).json({ messages });
  } catch (error) {
    logger.error('Error in get messages route', {
      error,
      requestId: req.requestId,
    });
  }
};

export default getMessagesRoute;

import { CoreMessage } from '@mastra/core';
import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { logger } from 'utils/logger';

const getMessagesParamsSchema = z.object({
  conversationId: z.string().min(1),
});

type GetMessagesOutput = {
  messages: CoreMessage[];
};

type ErrorResponse = {
  message: string;
};

const getMessagesRoute = async (
  req: Request,
  res: Response<GetMessagesOutput | ErrorResponse>
) => {
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
    const agent = mastra.getAgent('parsleyAgent');
    const memory = await agent.getMemory();
    if (!memory) {
      logger.error('Memory not found', {
        requestId: req.requestId,
      });
      res.status(500).json({ message: 'Memory not found' });
      return;
    }
    const thread = await memory.getThreadById({ threadId: conversationId });
    if (!thread) {
      logger.error('Thread not found', {
        requestId: req.requestId,
        conversationId,
      });
      res.status(404).json({ message: 'Thread not found' });
      return;
    }

    const messages = await memory.query({
      threadId: conversationId,
    });
    res.status(200).json({ messages: messages.messages });
  } catch (error) {
    logger.error('Error in get messages route', {
      error,
      requestId: req.requestId,
    });
  }
};

export default getMessagesRoute;

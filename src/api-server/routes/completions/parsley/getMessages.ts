import { CoreMessage } from '@mastra/core';
import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { PARSLEY_AGENT_NAME } from 'mastra/agents/constants';
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

  const apiUser = req.headers['api-user'] as string | undefined;
  const apiKey = req.headers['api-key'] as string | undefined;
  const userID = req.headers['end-user-header-id'] as string | undefined;

  logger.debug('Get messages authentication', {
    requestId: req.requestId,
    conversationId,
    apiUser,
    hasApiKey: !!apiKey,
    userID,
  });

  try {
    const agent = mastra.getAgent(PARSLEY_AGENT_NAME);
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
      res.status(404).json({ message: 'Conversation not found' });
      return;
    }

    if (thread.metadata) {
      const threadApiUser = thread.metadata.apiUser as string | undefined;
      const threadApiKey = thread.metadata.apiKey as string | undefined;

      const apiUserMatches = (apiUser || '') === (threadApiUser || '');
      const apiKeyMatches = (apiKey || '') === (threadApiKey || '');

      if (!apiUserMatches || !apiKeyMatches) {
        logger.error('Unauthorized access attempt', {
          requestId: req.requestId,
          conversationId,
          providedApiUser: apiUser,
          threadApiUser,
          apiUserMatches,
          apiKeyMatches,
        });
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
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
    res.status(500).json({ message: 'Internal server error' });
  }
};

export default getMessagesRoute;

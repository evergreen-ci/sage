import { convertMessages } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { UIMessage } from 'ai';
import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { ORCHESTRATOR_NAME } from 'mastra/networks/constants';
import { logger } from 'utils/logger';

const getMessagesParamsSchema = z.object({
  conversationId: z.string().min(1),
});

type GetMessagesOutput = {
  messages: UIMessage[];
};

type ErrorResponse = {
  message: string;
};

const getMessagesRoute = async (
  req: Request,
  res: Response<GetMessagesOutput | ErrorResponse>
) => {
  const { data: paramsData, success: paramsSuccess } =
    getMessagesParamsSchema.safeParse(req.params);
  if (!paramsSuccess) {
    logger.error('Invalid request params', {
      requestId: res.locals.requestId,
      params: req.params,
    });
    res.status(400).json({ message: 'Invalid request params' });
    return;
  }

  const { conversationId } = paramsData;

  const runtimeContext = new RuntimeContext();

  try {
    const network = mastra.vnext_getNetwork(ORCHESTRATOR_NAME);
    if (!network) {
      logger.error('Network not found', {
        requestId: res.locals.requestId,
        networkName: ORCHESTRATOR_NAME,
      });
      res.status(500).json({ message: 'Network not found' });
      return;
    }
    const memory = await network.getMemory({ runtimeContext });
    if (!memory) {
      logger.error('Memory not found', {
        requestId: res.locals.requestId,
      });
      res.status(500).json({ message: 'Memory not found' });
      return;
    }
    const thread = await memory.getThreadById({ threadId: conversationId });
    if (!thread) {
      logger.error('Thread not found', {
        requestId: res.locals.requestId,
        conversationId,
      });
      res.status(404).json({ message: 'Conversation not found' });
      return;
    }

    if (thread.metadata) {
      const threadOwner = thread.metadata.userId as string | undefined;

      if (threadOwner && threadOwner !== res.locals.userId) {
        logger.error('Unauthorized access attempt', {
          requestId: res.locals.requestId,
          conversationId,
          authenticatedUserId: res.locals.userId,
          threadOwner,
        });
        res.status(403).json({ message: 'Access denied to this conversation' });
        return;
      }
    } else {
      logger.error('Thread has no metadata, denying access', {
        requestId: res.locals.requestId,
        conversationId,
      });
      res.status(403).json({ message: 'Access denied to this conversation' });
      return;
    }

    const messages = await memory.query({
      threadId: conversationId,
    });
    const convertedMessages = convertMessages(messages.uiMessages).to(
      'AIV5.UI'
    );

    res.status(200).json({ messages: convertedMessages });
  } catch (error) {
    logger.error('Error in get messages route', {
      error,
      requestId: res.locals.requestId,
    });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export default getMessagesRoute;

import { CoreMessage } from '@mastra/core';
import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { ORCHESTRATOR_NAME } from 'mastra/networks/constants';
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
  logger.info('Get messages request received for network', {
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
    const network = mastra.getNetwork(ORCHESTRATOR_NAME);
    if (!network) {
      logger.error('Network not found', {
        requestId: req.requestId,
        networkName: ORCHESTRATOR_NAME,
      });
      res.status(500).json({ message: 'Network not found' });
      return;
    }
    const agents = network.getAgents();
    if (!Array.isArray(agents) || agents.length === 0) {
      logger.error('No agents found in network', {
        requestId: req.requestId,
      });
      res.status(500).json({ message: 'No agents found in network' });
      return;
    }
    const routingAgent = agents[0];
    if (!routingAgent) {
      logger.error('Invalid network agents', {
        requestId: req.requestId,
      });
      res.status(500).json({ message: 'Routing agent not found' });
      return;
    }
    const memory = await routingAgent.getMemory();
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

    const messages = await memory.query({
      threadId: conversationId,
    });
    res.status(200).json({ messages: messages.messages });
  } catch (error) {
    logger.error('Error in get messages route for network', {
      error,
      requestId: req.requestId,
    });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export default getMessagesRoute;

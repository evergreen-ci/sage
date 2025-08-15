import { LanguageModelV2Usage } from '@ai-sdk/provider';
import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { ORCHESTRATOR_NAME } from 'mastra/networks/constants';
import { logger } from 'utils/logger';

const addMessageInputSchema = z.object({
  message: z.string().min(1),
});

const addMessageParamsSchema = z.object({
  conversationId: z.string().min(1),
});

type AddMessageOutput = {
  message: string;
  requestId: string;
  timestamp: string;
  completionUsage: LanguageModelV2Usage;
  conversationId: string;
  agentInteractionSummary?: string;
};

type ErrorResponse = {
  message: string;
};

const addMessageRoute = async (
  req: Request,
  res: Response<AddMessageOutput | ErrorResponse>
) => {
  const { data: paramsData, success: paramsSuccess } =
    addMessageParamsSchema.safeParse(req.params);
  if (!paramsSuccess) {
    logger.error('Invalid request params', {
      requestId: req.requestId,
      params: req.params,
    });
    res.status(400).json({ message: 'Invalid request params' });
    return;
  }
  const { conversationId: conversationIdParam } = paramsData;

  const { data: messageData, success: messageSuccess } =
    addMessageInputSchema.safeParse(req.body);
  if (!messageSuccess) {
    logger.error('Invalid request body', {
      requestId: req.requestId,
      body: req.body,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }
  let conversationId =
    conversationIdParam === 'null' ? null : conversationIdParam;
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

    const routingAgent = network.getAgents()[0];
    if (!routingAgent) {
      logger.error('Invalid network agents', {
        requestId: req.requestId,
      });
      return;
    }
    const memory = await routingAgent.getMemory();
    let memoryOptions;

    // If the conversationId is not null, we use the existing thread
    // If the conversationId is null, we create a new thread
    if (conversationId) {
      // Populate session ID if provided
      const thread = await memory?.getThreadById({ threadId: conversationId });
      if (thread) {
        logger.debug('Found existing thread', {
          requestId: req.requestId,
          threadId: thread.id,
          resourceId: thread.resourceId,
        });
        memoryOptions = {
          thread: {
            id: thread.id,
          },
          resource: thread.resourceId,
        };
      } else {
        logger.error('Conversation not found', {
          requestId: req.requestId,
          conversationId: conversationId,
        });
        res.status(404).json({
          message: 'Conversation not found',
        });
        return;
      }
    } else {
      const newThread = await memory?.createThread({
        resourceId: 'parsley_network_completions',
      });
      if (!newThread) {
        res.status(500).json({
          message: 'Failed to create new thread',
        });
        return;
      }
      memoryOptions = {
        thread: {
          id: newThread.id,
        },
        resource: newThread.resourceId,
      };
    }

    conversationId =
      typeof memoryOptions.thread === 'string'
        ? memoryOptions.thread
        : memoryOptions.thread.id;

    const result = await network.generate(messageData.message, {
      memory: memoryOptions,
    });

    const agentInteractionSummary = network.getAgentInteractionSummary();

    res.json({
      message: result.text,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      completionUsage: result.usage,
      conversationId: conversationId,
      ...(agentInteractionSummary && { agentInteractionSummary }),
    });
  } catch (error) {
    logger.error('Error in add message route for network', {
      error,
      requestId: req.requestId,
    });
    res.status(500).json({
      message: 'Error in add message route',
    });
  }
};

export default addMessageRoute;

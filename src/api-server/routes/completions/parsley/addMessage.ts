import { AgentMemoryOption } from '@mastra/core/agent';
import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { PARSLEY_AGENT_NAME } from 'mastra/agents/constants';
import { logger } from 'utils/logger';
import { AddMessageOutput, ErrorResponse } from './index';

const addMessageInputSchema = z.object({
  message: z.string().min(1),
});

const addMessageParamsSchema = z.object({
  conversationId: z.string().min(1),
});

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
  let conversationId = conversationIdParam;
  try {
    const agent = mastra.getAgent(PARSLEY_AGENT_NAME);
    const memory = await agent.getMemory();
    let memoryOptions: AgentMemoryOption;

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

    conversationId =
      typeof memoryOptions.thread === 'string'
        ? memoryOptions.thread
        : memoryOptions.thread.id;

    const result = await agent.generate(messageData.message, {
      memory: memoryOptions,
    });

    res.json({
      message: result.text,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      completionUsage: result.usage,
      conversationId: conversationId,
    });
  } catch (error) {
    logger.error('Error in add message route', {
      error,
      requestId: req.requestId,
    });
    res.status(500).json({
      message: 'Error in add message route',
    });
  }
};

export default addMessageRoute;

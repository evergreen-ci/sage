import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { PARSLEY_AGENT_NAME } from 'mastra/agents/constants';
import { logger } from 'utils/logger';
import { AddMessageOutput, ErrorResponse } from './index';

const createConversationInputSchema = z.object({
  message: z.string().min(1),
});

const createConversationRoute = async (
  req: Request,
  res: Response<AddMessageOutput | ErrorResponse>
) => {
  const { data: messageData, success: messageSuccess } =
    createConversationInputSchema.safeParse(req.body);
  if (!messageSuccess) {
    logger.error('Invalid request body', {
      requestId: req.requestId,
      body: req.body,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }
  try {
    const agent = mastra.getAgent(PARSLEY_AGENT_NAME);
    const memory = await agent.getMemory();

    const newThread = await memory?.createThread({
      resourceId: 'parsley_completions',
    });
    if (!newThread) {
      res.status(500).json({
        message: 'Failed to create new thread',
      });
      return;
    }
    const memoryOptions = {
      thread: {
        id: newThread.id,
      },
      resource: newThread.resourceId,
    };

    const conversationId = memoryOptions.thread.id;

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

export default createConversationRoute;

import { AgentMemoryOption } from '@mastra/core/agent';
import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { PARSLEY_AGENT_NAME } from 'mastra/agents/constants';
import { logger } from 'utils/logger';

const createConversationInputSchema = z.object({
  message: z.string().min(1),
});

type CreateConversationOutput = {
  message: string;
  requestId: string;
  timestamp: string;
  completionUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  sessionId: string;
};

type ErrorResponse = {
  message: string;
};

const createConversationRoute = async (
  req: Request,
  res: Response<CreateConversationOutput | ErrorResponse>
) => {
  logger.info('Create conversation request received', {
    requestId: req.requestId,
    body: req.body,
  });

  const { data, success } = createConversationInputSchema.safeParse(req.body);
  if (!success) {
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

    logger.debug('Creating new thread', {
      requestId: req.requestId,
    });
    const newThread = await memory?.createThread({
      resourceId: 'parsley_completions',
    });
    if (!newThread) {
      res.status(500).json({
        message: 'Failed to create new thread',
      });
      return;
    }
    const memoryOptions: AgentMemoryOption = {
      thread: {
        id: newThread.id,
      },
      resource: newThread.resourceId,
    };
    const sessionId =
      typeof memoryOptions.thread === 'string'
        ? memoryOptions.thread
        : memoryOptions.thread.id;

    const result = await agent.generate(data.message, {
      memory: memoryOptions,
    });

    res.json({
      message: result.text,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      completionUsage: result.usage,
      sessionId,
    });
  } catch (error) {
    logger.error('Error in parsley completions route', {
      error,
      requestId: req.requestId,
    });
    res.status(500).json({
      message: 'Error in parsley completions route',
    });
  }
};

export default createConversationRoute;

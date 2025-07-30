import { AgentMemoryOption } from '@mastra/core/agent';
import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { logger } from 'utils/logger';

const parsleyCompletionsInputSchema = z.object({
  message: z.string().min(1),
  sessionID: z.string().optional(),
});

type ParsleyCompletionsOutput = {
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

const parsleyCompletionsRoute = async (
  req: Request,
  res: Response<ParsleyCompletionsOutput | ErrorResponse>
) => {
  logger.info('Parsley completions request received', {
    requestId: req.requestId,
    body: req.body,
  });

  const { data, success } = parsleyCompletionsInputSchema.safeParse(req.body);
  if (!success) {
    logger.error('Invalid request body', {
      requestId: req.requestId,
      body: req.body,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }
  try {
    const agent = mastra.getAgent('parsleyAgent');
    const memory = await agent.getMemory();
    let memoryOptions: AgentMemoryOption;

    // Populate session ID if provided
    if (data.sessionID) {
      const thread = await memory?.getThreadById({ threadId: data.sessionID });
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
        logger.error('Session not found', {
          requestId: req.requestId,
          sessionId: data.sessionID,
        });
        res.status(404).json({
          message: 'Session not found',
        });
        return;
      }
    } else {
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
      memoryOptions = {
        thread: {
          id: newThread.id,
        },
        resource: newThread.resourceId,
      };
    }
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

export default parsleyCompletionsRoute;

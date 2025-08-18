import { LanguageModelV2Usage } from '@ai-sdk/provider';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { PARSLEY_AGENT_NAME } from 'mastra/agents/constants';
import { logger } from 'utils/logger';
import {
  AuthenticatedRequest,
  extractUserIdFromKanopyHeader,
} from '../../../middlewares/authentication';

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
};

type ErrorResponse = {
  message: string;
};

const addMessageRoute = async (
  req: AuthenticatedRequest,
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

  const runtimeContext = new RuntimeContext();

  const kanopyAuthHeader = req.headers['X-Kanopy-Internal-Authorization'] as
    | string
    | undefined;
  const userId = kanopyAuthHeader
    ? extractUserIdFromKanopyHeader(kanopyAuthHeader)
    : null;

  const authenticatedUserId = req.userId || userId || 'anonymous';

  runtimeContext.set('userId', authenticatedUserId);

  logger.debug('User context set for request', {
    userId: authenticatedUserId,
    requestId: req.requestId,
  });

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
    const agent = mastra.getAgent(PARSLEY_AGENT_NAME);
    const memory = await agent.getMemory();
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
        resourceId: 'parsley_completions',
        metadata: {
          userId: authenticatedUserId,
        },
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

    const result = await agent.generate(messageData.message, {
      memory: memoryOptions,
      runtimeContext,
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

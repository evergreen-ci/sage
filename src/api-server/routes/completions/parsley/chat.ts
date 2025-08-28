import { AgentMemoryOption } from '@mastra/core/agent';
import {
  pipeUIMessageStreamToResponse,
  UIMessage,
  validateUIMessages,
} from 'ai';
import { Request, Response } from 'express';
import z from 'zod';
import { logMetadataSchema } from 'constants/parsley/logMetadata';
import { mastra } from 'mastra';
import { createParsleyRuntimeContext } from 'mastra/memory/parsley/runtimeContext';
import { logger } from 'utils/logger';
import { USER_ID } from '../../../../mastra/agents/constants';
import { runWithRequestContext } from '../../../../mastra/utils/requestContext';
import { getUserIdFromRequest } from '../../../middlewares/authentication';
import { uiMessageSchema } from './validators';

const addMessageInputSchema = z.object({
  id: z.string(),
  logMetadata: logMetadataSchema.optional(),
  // UIMessage arrays and strings are both valid inputs to agent.stream, so accept either.
  message: z.union([z.string(), uiMessageSchema]),
});

type ErrorResponse = {
  message: string;
};

const chatRoute = async (
  req: Request,
  res: Response<ReadableStream | ErrorResponse>
) => {
  const runtimeContext = createParsleyRuntimeContext();
  const authenticatedUserId = getUserIdFromRequest(req);
  if (!authenticatedUserId) {
    logger.error('No authentication provided', {
      requestId: req.requestId,
    });
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  runtimeContext.set(USER_ID, authenticatedUserId);
  logger.debug('User context set for request', {
    userId: authenticatedUserId,
    requestId: req.requestId,
  });

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
  runtimeContext.set('logMetadata', messageData.logMetadata);

  const conversationId = messageData.id;

  let validatedMessage: string | UIMessage[];
  try {
    if (typeof messageData.message === 'string') {
      validatedMessage = messageData.message;
    } else {
      validatedMessage = await validateUIMessages({
        messages: [messageData.message],
      });
    }
  } catch (error) {
    logger.error('Invalid UIMessage request params', {
      requestId: req.requestId,
      params: req.params,
    });
    res.status(400).json({ message: 'Invalid UIMessage request params' });
    return;
  }

  try {
    const agent = mastra.getAgent('sageThinkingAgent');

    const memory = await agent.getMemory({
      runtimeContext,
    });

    let memoryOptions: AgentMemoryOption = {
      thread: {
        id: 'undefined',
      },
      resource: 'undefined',
    };
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
      const newThread = await memory?.createThread({
        metadata: runtimeContext.toJSON(),
        resourceId: 'parsley_completions',
        threadId: conversationId,
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

    const stream = await runWithRequestContext(
      { userId: authenticatedUserId, requestId: req.requestId },
      async () =>
        await agent.streamVNext(validatedMessage, {
          runtimeContext,
          memory: memoryOptions,
          format: 'aisdk',
          // TODO: We should be able to use generateMessageId here to standardize the ID returned to the client and saved in MongoDB. However, this isn't working right in the alpha version yet.
          // Thread ID is set correctly, which is most important.
          // https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence#setting-up-server-side-id-generation
        })
    );

    // Get the UIMessage stream and pipe it to Express with correct headers & backpressure.
    pipeUIMessageStreamToResponse({
      response: res,
      stream: stream.toUIMessageStream(),
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

export default chatRoute;

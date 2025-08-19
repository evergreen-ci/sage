import { validateUIMessages } from 'ai';
import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { PARSLEY_AGENT_NAME } from 'mastra/agents/constants';
import { LogTypes } from 'types/parsley';
import { logger } from 'utils/logger';
import { uiMessageSchema, logMetadataSchema } from './validators';

const addMessageInputSchema = z.object({
  id: z.string(),
  logMetadata: logMetadataSchema,
  // UIMessage arrays and strings are both valid inputs to agent.stream, so accept either.
  message: z.union([z.string(), uiMessageSchema]),
});

const addMessageParamsSchema = z.object({
  conversationId: z.string().min(1),
});

type ErrorResponse = {
  message: string;
};

const addMessageRoute = async (
  req: Request,
  res: Response<ReadableStream | ErrorResponse>
) => {
  const { success: paramsSuccess } = addMessageParamsSchema.safeParse(
    req.params
  );
  if (!paramsSuccess) {
    logger.error('Invalid request params', {
      requestId: req.requestId,
      params: req.params,
    });
    res.status(400).json({ message: 'Invalid request params' });
    return;
  }

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

  const conversationId = messageData.id;

  let validatedMessage;
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
    const agent = mastra.getAgent(PARSLEY_AGENT_NAME);
    const memory = await agent.getMemory();
    let memoryOptions;

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
      const { logMetadata } = messageData;
      const metadata: Record<string, string | number> = {
        task_id: logMetadata.task_id,
        execution: logMetadata.execution,
        log_type: logMetadata.log_type,
      };

      switch (logMetadata.log_type) {
        case LogTypes.EVERGREEN_TEST_LOGS:
          metadata.test_id = logMetadata.test_id;
          break;
        case LogTypes.EVERGREEN_TASK_LOGS:
          metadata.origin = logMetadata.origin;
          break;
        default:
          break;
      }

      const newThread = await memory?.createThread({
        metadata,
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

    const stream = await agent.stream(validatedMessage, {
      memory: memoryOptions,
      // TODO: We should be able to use generateMessageId here to standardize the ID returned to the client and saved in MongoDB. However, this isn't working right in the alpha version yet.
      // https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence#setting-up-server-side-id-generation
    });

    stream.pipeUIMessageStreamToResponse(res);
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

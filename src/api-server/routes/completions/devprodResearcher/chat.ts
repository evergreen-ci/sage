import { toAISdkStream } from '@mastra/ai-sdk';
import { AgentMemoryOption } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { trace } from '@opentelemetry/api';
import {
  pipeUIMessageStreamToResponse,
  UIMessage,
  validateUIMessages,
} from 'ai';
import { Request, Response } from 'express';
import { z } from 'zod';
import { mastra } from '@/mastra';
import {
  DEVPROD_RESEARCHER_AGENT_NAME,
  USER_ID,
} from '@/mastra/agents/constants';
import { runWithRequestContext } from '@/mastra/utils/requestContext';
import { createAISdkStreamWithMetadata } from '@/utils/ai';
import { logger } from '@/utils/logger';

const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(z.any()),
});

const chatInputSchema = z.object({
  id: z.string(),
  message: z.union([z.string(), uiMessageSchema]),
});

type ErrorResponse = {
  message: string;
};

const chatRoute = async (
  req: Request,
  res: Response<ReadableStream | ErrorResponse>
) => {
  const currentSpan = trace.getActiveSpan();
  const spanContext = currentSpan?.spanContext();

  const requestContext = new RequestContext<{ [USER_ID]: string }>();
  requestContext.set(USER_ID, res.locals.userId!);

  const untypedRequestContext =
    requestContext as unknown as RequestContext<unknown>;

  logger.debug('DevProd researcher request', {
    userId: res.locals.userId,
    requestId: res.locals.requestId,
  });

  const {
    data: messageData,
    error: messageError,
    success: messageSuccess,
  } = chatInputSchema.safeParse(req.body);

  if (!messageSuccess) {
    logger.error('Invalid request body', {
      requestId: res.locals.requestId,
      body: req.body,
      error: messageError,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

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
      requestId: res.locals.requestId,
      params: req.params,
    });
    res.status(400).json({ message: 'Invalid UIMessage request params' });
    return;
  }

  try {
    const agent = mastra.getAgent(DEVPROD_RESEARCHER_AGENT_NAME);

    const memory = await agent.getMemory({
      requestContext: untypedRequestContext,
    });

    let memoryOptions: AgentMemoryOption = {
      thread: {
        id: 'undefined',
      },
      resource: 'undefined',
    };

    const thread = await memory?.getThreadById({ threadId: conversationId });
    if (thread) {
      logger.debug('Found existing thread', {
        requestId: res.locals.requestId,
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
        metadata: requestContext.toJSON(),
        resourceId: 'devprod_researcher',
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
      { userId: res.locals.userId, requestId: res.locals.requestId },
      async () =>
        await agent.stream(validatedMessage, {
          requestContext: requestContext,
          memory: memoryOptions,
          tracingOptions: {
            metadata: {
              userId: res.locals.userId,
              requestID: res.locals.requestId,
            },
            ...(spanContext
              ? {
                  traceId: spanContext.traceId,
                  parentSpanId: spanContext.spanId,
                }
              : {}),
          },
        })
    );

    pipeUIMessageStreamToResponse({
      response: res,
      stream: createAISdkStreamWithMetadata(
        toAISdkStream(stream, { from: 'agent' })!,
        {
          spanId: stream.traceId,
        }
      ),
    });
  } catch (error) {
    logger.error('Error in devprod researcher chat route', {
      error,
      requestId: res.locals.requestId,
    });
    res.status(500).json({
      message: 'Error in devprod researcher chat route',
    });
  }
};

export default chatRoute;

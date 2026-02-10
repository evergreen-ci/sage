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
import { logMetadataSchema } from '@/constants/parsley/logMetadata';
import { mastra } from '@/mastra';
import { SAGE_THINKING_AGENT_NAME, USER_ID } from '@/mastra/agents/constants';
import { createParsleyRequestContext } from '@/mastra/memory/parsley/requestContext';
import { runWithRequestContext } from '@/mastra/utils/requestContext';
import { createAISdkStreamWithMetadata } from '@/utils/ai';
import { logger } from '@/utils/logger';
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
  const currentSpan = trace.getActiveSpan();
  const spanContext = currentSpan?.spanContext();
  const requestContext = createParsleyRequestContext();
  // userId is guaranteed by userIdMiddleware (returns 401 if missing)
  requestContext.set(USER_ID, res.locals.userId!);
  // Mastra APIs (run.start, getMemory) expect RequestContext<unknown>, but our typed context
  // isn't directly assignable due to generic variance. This cast is safe since RequestContext
  // is structurally compatible at runtime.
  const untypedRequestContext =
    requestContext as unknown as RequestContext<unknown>;
  logger.debug('User context set for request', {
    userId: res.locals.userId,
    requestId: res.locals.requestId,
  });

  const {
    data: messageData,
    error: messageError,
    success: messageSuccess,
  } = addMessageInputSchema.safeParse(req.body);
  if (!messageSuccess) {
    logger.error('Invalid request body', {
      requestId: res.locals.requestId,
      body: req.body,
      error: messageError,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }
  if (messageData.logMetadata) {
    requestContext.set('logMetadata', messageData.logMetadata);
  }
  if (requestContext.get('logURL') === undefined && messageData.logMetadata) {
    const logFileUrlWorkflow = mastra.getWorkflowById<'resolve-log-file-url'>(
      'resolve-log-file-url'
    );
    if (!logFileUrlWorkflow) {
      logger.error('resolve-log-file-url workflow not found', {
        requestId: res.locals.requestId,
      });
      res
        .status(500)
        .json({ message: 'resolve-log-file-url workflow not found' });
      return;
    }
    const run = await logFileUrlWorkflow.createRun({});
    if (!run) {
      logger.error('Failed to create log file url workflow run', {
        requestId: res.locals.requestId,
      });
      res
        .status(500)
        .json({ message: 'Failed to create log file url workflow run' });
      return;
    }
    const runResult = await run.start({
      inputData: {
        logMetadata: messageData.logMetadata,
      },
      ...(spanContext
        ? {
            traceId: spanContext.traceId,
            parentSpanId: spanContext.spanId,
          }
        : {}),
      tracingOptions: {
        metadata: {
          userId: res.locals.userId,
          requestId: res.locals.requestId,
        },
      },
      requestContext: untypedRequestContext,
    });
    if (runResult.status === 'success') {
      requestContext.set('logURL', runResult.result);
    } else if (runResult.status === 'failed') {
      logger.error('Error in get log file url workflow', {
        requestId: res.locals.requestId,
        error: runResult.error,
      });
    }
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
    const agent = mastra.getAgent(SAGE_THINKING_AGENT_NAME);

    const memory = await agent.getMemory({
      requestContext: untypedRequestContext,
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

    // Get the UIMessage stream and pipe it to Express with correct headers & backpressure.
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
    logger.error('Error in add message route', {
      error,
      requestId: res.locals.requestId,
    });
    res.status(500).json({
      message: 'Error in add message route',
    });
  }
};

export default chatRoute;

import { AgentMemoryOption } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { trace } from '@opentelemetry/api';
import express from 'express';
import { mastra } from '@/mastra';
import { RELEASE_NOTES_AGENT_NAME, USER_ID } from '@/mastra/agents/constants';
import {
  generateReleaseNotes,
  releaseNotesInputSchema,
} from '@/mastra/agents/releaseNotesAgent';
import { logger } from '@/utils/logger';

type ReleaseNotesRuntimeContext = {
  [USER_ID]?: string;
};

const releaseNotesRouter = express.Router();

releaseNotesRouter.post('/', async (req, res) => {
  const parsedInput = releaseNotesInputSchema.safeParse(req.body);

  if (!parsedInput.success) {
    const { fieldErrors, formErrors } = parsedInput.error.flatten();
    logger.warn('Invalid release notes request body', {
      requestId: res.locals.requestId,
      fieldErrors,
      formErrors,
    });
    res.status(400).json({
      message: 'Invalid request body',
      errors: {
        fieldErrors,
        formErrors,
      },
    });
    return;
  }

  const runtimeContext = new RuntimeContext<ReleaseNotesRuntimeContext>();
  runtimeContext.set(USER_ID, res.locals.userId);

  const currentSpan = trace.getActiveSpan();
  const spanContext = currentSpan?.spanContext();

  try {
    // Set up memory options only if product is provided
    let memoryOptions: AgentMemoryOption | undefined;

    if (parsedInput.data.product) {
      // Get agent and memory for product-specific context
      const agent = mastra.getAgent(RELEASE_NOTES_AGENT_NAME);
      const memory = await agent.getMemory({ runtimeContext });

      if (memory) {
        // Set up memory options with product-based resourceId
        const resourceId = `release_notes:${parsedInput.data.product}`;
        const threadId = `${parsedInput.data.product}-${res.locals.requestId}`;

        memoryOptions = {
          thread: { id: 'undefined' },
          resource: 'undefined',
        };

        // Check if thread exists, otherwise create new one
        const thread = await memory.getThreadById({ threadId });
        if (thread && typeof thread !== 'string') {
          logger.debug('Found existing thread for release notes', {
            requestId: res.locals.requestId,
            product: parsedInput.data.product,
            threadId: thread.id,
            resourceId: thread.resourceId,
          });
          memoryOptions = {
            thread: { id: thread.id },
            resource: thread.resourceId,
          };
        } else {
          const newThread = await memory.createThread({
            metadata: {
              product: parsedInput.data.product,
              ...runtimeContext.toJSON(),
            },
            resourceId,
            threadId,
          });
          if (newThread) {
            logger.debug('Created new thread for release notes', {
              requestId: res.locals.requestId,
              product: parsedInput.data.product,
              threadId: newThread.id,
              resourceId: newThread.resourceId,
            });
            memoryOptions = {
              thread: { id: newThread.id },
              resource: newThread.resourceId,
            };
          } else {
            logger.warn('Failed to create thread, continuing without memory', {
              requestId: res.locals.requestId,
              product: parsedInput.data.product,
            });
            memoryOptions = undefined;
          }
        }
      }
    } else {
      logger.debug('Skipping memory setup - product not provided', {
        requestId: res.locals.requestId,
      });
    }

    const result = await generateReleaseNotes(parsedInput.data, {
      runtimeContext,
      ...(memoryOptions ? { memory: memoryOptions } : {}),
      tracingOptions: {
        metadata: {
          userId: res.locals.userId,
          requestId: res.locals.requestId,
          ...(parsedInput.data.product
            ? { product: parsedInput.data.product }
            : {}),
        },
        ...(spanContext
          ? {
              traceId: spanContext.traceId,
              parentSpanId: spanContext.spanId,
            }
          : {}),
      },
    });

    if (!result.object) {
      logger.error('Release notes agent returned no structured output', {
        requestId: res.locals.requestId,
        ...(parsedInput.data.product
          ? { product: parsedInput.data.product }
          : {}),
      });
      res.status(502).json({
        message: 'Agent returned no structured output',
      });
      return;
    }

    // Note: Messages are automatically stored by the agent when using memory options
    // The successful output will be available in memory for future product-specific learning

    res.status(200).json(result.object);
  } catch (error) {
    logger.error('Failed to generate release notes', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              cause: error.cause,
            }
          : String(error),
      requestId: res.locals.requestId,
    });
    res.status(500).json({
      message: 'Failed to generate release notes',
      ...(error instanceof Error && process.env.NODE_ENV !== 'production'
        ? { details: error.message }
        : {}),
    });
  }
});

export default releaseNotesRouter;

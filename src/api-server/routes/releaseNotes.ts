import { RuntimeContext } from '@mastra/core/runtime-context';
import { trace } from '@opentelemetry/api';
import express from 'express';
import { USER_ID } from '@/mastra/agents/constants';
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
    const result = await generateReleaseNotes(parsedInput.data, {
      runtimeContext,
      tracingOptions: {
        metadata: {
          userId: res.locals.userId,
          requestId: res.locals.requestId,
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
      });
      res.status(502).json({
        message: 'Agent returned no structured output',
      });
      return;
    }

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

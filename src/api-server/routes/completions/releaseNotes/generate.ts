import { RuntimeContext } from '@mastra/core/runtime-context';
import { trace } from '@opentelemetry/api';
import { Request, Response } from 'express';
import { USER_ID } from '@/mastra/agents/constants';
import { releaseNotesInputSchema } from '@/mastra/agents/releaseNotesAgent';
import { releaseNotesWorkflow } from '@/mastra/workflows/releaseNotes';
import { logger } from '@/utils/logger';

type ReleaseNotesRuntimeContext = {
  [USER_ID]?: string;
};

/**
 * POST /completions/release-notes/generate
 *
 * Generates structured release notes from Jira issues and pull request metadata.
 *
 * Request body:
 * - jiraIssues: Array of Jira issue objects (required)
 * - sections: Array of section titles (optional, defaults to ["Improvements", "Bug Fixes"])
 * - customGuidelines: Optional custom formatting guidelines
 * - product: Optional product name (for tracking/logging purposes)
 *
 * Response:
 * - sections: Array of release note sections with items, citations, and links
 * @param req Incoming request.
 * @param res Outgoing response.
 */
const generateReleaseNotesRoute = async (req: Request, res: Response) => {
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
    // Create workflow run
    const run = await releaseNotesWorkflow.createRunAsync({});

    // Execute workflow
    const runResult = await run.start({
      inputData: parsedInput.data,
      runtimeContext,
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

    if (runResult.status === 'success') {
      res.status(200).json(runResult.result);
      return;
    }

    if (runResult.status === 'failed') {
      const errorMessage =
        runResult.error instanceof Error
          ? runResult.error.message
          : String(runResult.error);
      logger.error('Release notes workflow failed', {
        requestId: res.locals.requestId,
        error: errorMessage,
        ...(parsedInput.data.product
          ? { product: parsedInput.data.product }
          : {}),
      });
      res.status(500).json({
        message: 'Failed to generate release notes',
        ...(process.env.NODE_ENV !== 'production'
          ? { details: errorMessage }
          : {}),
      });
      return;
    }

    logger.error('Unexpected workflow status', {
      requestId: res.locals.requestId,
      status: runResult.status,
    });
    res.status(500).json({
      message: 'Unexpected workflow execution status',
    });
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
};

export default generateReleaseNotesRoute;

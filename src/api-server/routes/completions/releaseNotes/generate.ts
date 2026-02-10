import { trace } from '@opentelemetry/api';
import { Request, Response } from 'express';
import { z } from 'zod';
import { releaseNotesInputSchema } from '@/mastra/agents/releaseNotesAgent';
import { releaseNotesWorkflow } from '@/mastra/workflows/releaseNotes';
import { logger } from '@/utils/logger';

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
    const { errors, properties } = z.treeifyError(parsedInput.error);
    logger.warn('Invalid release notes request body', {
      requestId: res.locals.requestId,
      errors,
      properties,
    });
    res.status(400).json({
      message: 'Invalid request body',
      errors,
      properties,
    });
    return;
  }

  const currentSpan = trace.getActiveSpan();
  const spanContext = currentSpan?.spanContext();

  try {
    // Create workflow run
    const run = await releaseNotesWorkflow.createRun({});

    // Execute workflow
    const runResult = await run.start({
      inputData: parsedInput.data,
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
          product: parsedInput.data.product,
          jiraIssueCount: parsedInput.data.jiraIssues.length,
          inputSections: parsedInput.data.sections,
        },
      },
    });

    if (runResult.status === 'success') {
      res.status(200).json(runResult.result);
      return;
    }

    if (runResult.status === 'failed') {
      const errorMessage = runResult.error.message;
      logger.error('Release notes workflow failed', {
        requestId: res.locals.requestId,
        error: errorMessage,
        product: parsedInput.data.product,
      });
      res.status(500).json({
        message: 'Failed to generate release notes',
        details: errorMessage,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to generate release notes', {
      error: errorMessage,
      requestId: res.locals.requestId,
    });
    res.status(500).json({
      message: 'Failed to generate release notes',
      details: errorMessage,
    });
  }
};

export default generateReleaseNotesRoute;

import { trace } from '@opentelemetry/api';
import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from '@/mastra';
import {
  SLACK_THREAD_SUMMARIZER_AGENT_NAME,
  USER_ID,
} from '@/mastra/agents/constants';
import { SlackThreadSummary } from '@/mastra/agents/slackThreadSummarizerAgent';
import { createParsleyRuntimeContext } from '@/mastra/memory/parsley/runtimeContext';
import { runWithRequestContext } from '@/mastra/utils/requestContext';
import { logger } from '@/utils/logger';

const summarizeThreadInputSchema = z.object({
  slackThreadCapture: z
    .string()
    .min(1)
    .describe('The full Slack thread capture text'),
});

type ErrorResponse = {
  message: string;
};

type SuccessResponse = SlackThreadSummary;

const summarizeThreadRoute = async (
  req: Request,
  res: Response<SuccessResponse | ErrorResponse>
) => {
  const currentSpan = trace.getActiveSpan();
  const spanContext = currentSpan?.spanContext();
  const runtimeContext = createParsleyRuntimeContext();
  runtimeContext.set(USER_ID, res.locals.userId);

  logger.debug('User context set for Slack thread summarization request', {
    userId: res.locals.userId,
    requestId: res.locals.requestId,
  });

  // Validate input
  const {
    data: inputData,
    error: inputError,
    success: inputSuccess,
  } = summarizeThreadInputSchema.safeParse(req.body);

  if (!inputSuccess) {
    logger.error('Invalid request body', {
      requestId: res.locals.requestId,
      body: req.body,
      error: inputError,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  // Get the Slack thread summarizer agent
  const agent = mastra.getAgent(SLACK_THREAD_SUMMARIZER_AGENT_NAME);
  if (!agent) {
    logger.error('Slack thread summarizer agent not found', {
      requestId: res.locals.requestId,
    });
    res
      .status(500)
      .json({ message: 'Slack thread summarizer agent not found' });
    return;
  }

  try {
    // Generate the thread summary
    const result = await runWithRequestContext(
      { userId: res.locals.userId, requestId: res.locals.requestId },
      async () =>
        await agent.generate(inputData.slackThreadCapture, {
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
        })
    );

    // Parse the response
    const summaryData = JSON.parse(result.text) as SlackThreadSummary;

    logger.info('Successfully generated Slack thread summary', {
      requestId: res.locals.requestId,
      reporter: summaryData.reporter,
      title: summaryData.title,
    });

    res.status(200).json(summaryData);
  } catch (error) {
    logger.error('Error generating Slack thread summary', {
      requestId: res.locals.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    res
      .status(500)
      .json({ message: 'Failed to generate Slack thread summary' });
  }
};

export default summarizeThreadRoute;

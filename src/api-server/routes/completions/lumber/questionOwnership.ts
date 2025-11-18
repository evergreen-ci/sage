import { Request, Response } from 'express';
import { z } from 'zod';
import { mastra } from '@/mastra';
import { SLACK_QUESTION_OWNERSHIP_AGENT_NAME } from '@/mastra/agents/constants';
import { questionOwnershipOutputSchema } from '@/mastra/agents/questionOwnershipAgent';
import { logger } from '@/utils/logger';

/** Request body schema */
const questionOwnershipRequestSchema = z.object({
  question: z.string().min(1),
});

/** Response body type */
type QuestionOwnershipResponse = {
  teamName: string;
  teamId: string;
  reasoning: string;
};

/** Error response type */
type ErrorResponse = {
  message: string;
};

/**
 * GET /completions/lumber/determine-owner
 *
 * Routes a user question to the appropriate DevProd team.
 *
 * Request body:
 * - question: string (required) - The user's question to route
 *
 * Response:
 * - teamName: string - The Jira assigned team that should handle the question
 * - teamId: string - The Jira ID of the team that should handle the question
 * - reasoning: string - Explanation of the routing decision
 * @param req Incoming request.
 * @param res Outgoing response.
 */
const questionOwnershipRoute = async (
  req: Request,
  res: Response<QuestionOwnershipResponse | ErrorResponse>
) => {
  const { data, error, success } = questionOwnershipRequestSchema.safeParse(
    req.body
  );

  if (!success) {
    logger.error('Invalid request body for question ownership', {
      requestId: res.locals.requestId,
      body: req.body,
      error,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  try {
    const agent = mastra.getAgent(SLACK_QUESTION_OWNERSHIP_AGENT_NAME);

    if (!agent) {
      logger.error('question ownership agent not found', {
        requestId: res.locals.requestId,
      });
      res
        .status(500)
        .json({ message: 'question ownership agent not configured' });
      return;
    }

    logger.debug('Calling question ownership agent', {
      requestId: res.locals.requestId,
      question: data.question,
    });

    const result = await agent.generate(data.question, {
      tracingOptions: {
        metadata: {
          requestId: res.locals.requestId,
          question: data.question,
        },
      },
      structuredOutput: {
        schema: questionOwnershipOutputSchema,
      },
    });

    // Parse the structured output
    if (!result.object) {
      logger.error('Agent did not return structured output', {
        requestId: res.locals.requestId,
        resultText: result.text,
        error: result.error,
      });
      res.status(500).json({ message: 'Invalid agent response format' });
      return;
    }

    const { reasoning, teamId, teamName } = result.object;

    logger.info('question ownership determined', {
      requestId: res.locals.requestId,
      question: data.question,
      teamName,
      teamId,
      reasoning,
    });

    res.json({
      teamName,
      teamId,
      reasoning,
    });
  } catch (err) {
    logger.error('Error in question ownership route', {
      err,
      requestId: res.locals.requestId,
      question: data.question,
    });
    res
      .status(500)
      .json({ message: 'Error processing question ownership request' });
  }
};

export default questionOwnershipRoute;

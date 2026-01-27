import { Request, Response } from 'express';
import { z } from 'zod';
import { mastra } from '@/mastra';
import { SLACK_QUESTION_OWNERSHIP_AGENT_NAME } from '@/mastra/agents/constants';
import { questionOwnershipOutputSchema } from '@/mastra/agents/questionOwnershipAgent';
import { vectorStore } from '@/mastra/utils/memory';
import { generateEmbedding } from '@/mastra/utils/voyage';
import { logger } from '@/utils/logger';
import {
  MAX_QUESTION_LENGTH,
  QUESTION_OWNERSHIP_INDEX,
  SIMILARITY_THRESHOLD,
  TOP_K_RESULTS,
} from './constants';
import type { ErrorResponse, QuestionOwnershipResponse } from './types';

/** Request body schema with max length validation and trim */
const questionOwnershipRequestSchema = z.object({
  question: z
    .string()
    .min(1)
    .max(MAX_QUESTION_LENGTH)
    .transform(q => q.trim()),
});

/**
 * POST /completions/lumber/determine-owner-with-embeddings
 *
 * Routes a user question to the appropriate DevProd team using embeddings,
 * with a fallback to an agent if similarity score is low.
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
const questionOwnershipWithEmbeddingsRoute = async (
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
    const embedding = await generateEmbedding(data.question);

    const results = await vectorStore.query({
      indexName: QUESTION_OWNERSHIP_INDEX,
      queryVector: embedding,
      topK: TOP_K_RESULTS,
    });

    const topResult = results[0];

    if (topResult && topResult.score >= SIMILARITY_THRESHOLD) {
      const { teamId, teamName } = (topResult.metadata || {}) as {
        teamId: string;
        teamName: string;
      };

      if (teamName && teamId) {
        logger.info('Question ownership determined via embeddings', {
          requestId: res.locals.requestId,
          question: data.question,
          teamName,
          teamId,
          score: topResult.score,
        });

        res.json({
          reasoning: `Determined via embedding similarity (score: ${topResult.score.toFixed(4)})`,
          teamId,
          teamName,
        });
        return;
      }
    }

    // Fallback to Agent
    logger.info(
      topResult
        ? `Similarity score too low (${topResult.score.toFixed(4)}), falling back to agent`
        : 'No embedding matches found, falling back to agent',
      {
        requestId: res.locals.requestId,
        question: data.question,
      }
    );

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

    const generateOptions =
      await agent.getDefaultOptions<typeof questionOwnershipOutputSchema>();
    const result = await agent.generate(data.question, {
      tracingOptions: {
        metadata: {
          requestId: res.locals.requestId,
          question: data.question,
        },
      },
      ...generateOptions,
    });

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

    logger.info('question ownership determined via agent fallback', {
      requestId: res.locals.requestId,
      question: data.question,
      teamName,
      teamId,
    });

    res.json({
      reasoning: `Determined via agent fallback. Reasoning: ${reasoning}`,
      teamId,
      teamName,
    });
  } catch (err) {
    logger.error('Error in question ownership with embeddings route', {
      err,
      requestId: res.locals.requestId,
      question: data.question,
    });
    res
      .status(500)
      .json({ message: 'Error processing question ownership request' });
  }
};

export default questionOwnershipWithEmbeddingsRoute;

import { Request, Response } from 'express';
import { z } from 'zod';
import { vectorStore } from '@/mastra/utils/memory';
import { generateEmbeddings } from '@/mastra/utils/voyage';
import { logger } from '@/utils/logger';
import {
  MAX_BATCH_SIZE,
  MAX_QUESTION_LENGTH,
  QUESTION_OWNERSHIP_INDEX,
} from './constants';
import type { ErrorResponse, UpsertQuestionOwnershipResponse } from './types';

/** Schema for a single question-team mapping */
const questionTeamMappingSchema = z.object({
  question: z
    .string()
    .min(1)
    .max(MAX_QUESTION_LENGTH)
    .transform(q => q.trim()),
  teamName: z.string().min(1),
  teamId: z.string().min(1),
});

/** Request body schema with batch size limit */
const upsertQuestionOwnershipRequestSchema = z.object({
  mappings: z
    .array(questionTeamMappingSchema)
    .min(1, 'At least one mapping required')
    .max(
      MAX_BATCH_SIZE,
      `Maximum ${MAX_BATCH_SIZE} mappings allowed per request`
    ),
});

/**
 * POST /completions/lumber/upsert-owner-with-embeddings
 *
 * Upserts question-team mappings with their embeddings.
 *
 * Request body:
 * - mappings: Array of { question: string, teamName: string, teamId: string }
 *
 * Response:
 * - message: string - Success message
 * - count: number - Number of mappings upserted
 * @param req Incoming request.
 * @param res Outgoing response.
 */
const upsertQuestionOwnershipWithEmbeddingsRoute = async (
  req: Request,
  res: Response<UpsertQuestionOwnershipResponse | ErrorResponse>
) => {
  const { data, error, success } =
    upsertQuestionOwnershipRequestSchema.safeParse(req.body);

  if (!success) {
    logger.error('Invalid request body for upsert question ownership', {
      requestId: res.locals.requestId,
      body: req.body,
      error,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  try {
    const questions = data.mappings.map(m => m.question);

    logger.info('Generating embeddings for questions', {
      requestId: res.locals.requestId,
      count: questions.length,
    });

    const embeddings = await generateEmbeddings(questions);

    const vectors: number[][] = [];
    const metadata: Record<string, string | number | boolean>[] = [];
    const ids: string[] = [];

    embeddings.forEach((embedding, index) => {
      const mapping = data.mappings[index];
      vectors.push(embedding);
      metadata.push({
        question: mapping.question,
        teamName: mapping.teamName,
        teamId: mapping.teamId,
      });
      ids.push(Buffer.from(mapping.question).toString('base64')); // Use base64 of question as ID for idempotency
    });

    logger.info('Upserting embeddings to vector store', {
      requestId: res.locals.requestId,
      count: vectors.length,
    });

    await vectorStore.upsert({
      indexName: QUESTION_OWNERSHIP_INDEX,
      vectors,
      metadata,
      ids,
    });

    res.json({
      message: 'Successfully upserted question ownership mappings',
      count: vectors.length,
    });
  } catch (err) {
    logger.error('Error in upsert question ownership route', {
      err,
      requestId: res.locals.requestId,
    });
    res
      .status(500)
      .json({ message: 'Error processing upsert question ownership request' });
  }
};

export default upsertQuestionOwnershipWithEmbeddingsRoute;

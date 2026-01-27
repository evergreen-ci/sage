/**
 * Constants for question ownership routing with embeddings
 */
import { config } from '@/config';

/**
 * Vector store index name for question ownership embeddings.
 */
export const QUESTION_OWNERSHIP_INDEX = config.questionOwnership.indexName;

/**
 * Minimum similarity score (0.0-1.0) to accept an embedding match.
 * Scores below this fall back to the LLM agent.
 * Default: 0.75. Configure via EMBEDDING_SIMILARITY_THRESHOLD env var.
 */
export const SIMILARITY_THRESHOLD =
  config.questionOwnership.similarityThreshold;

/**
 * Number of similar results to retrieve from vector search.
 * Set to 1 for deterministic single-team routing.
 */
export const TOP_K_RESULTS = 1;

/** Maximum mappings per upsert request. */
export const MAX_BATCH_SIZE = 100;

/** Maximum question character length. */
export const MAX_QUESTION_LENGTH = 2000;

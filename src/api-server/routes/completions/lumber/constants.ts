/**
 * Constants for question ownership routing with embeddings
 */

/** The name of the vector store index for question ownership embeddings */
export const QUESTION_OWNERSHIP_INDEX = 'questionOwnership';

/** Minimum similarity score threshold for accepting embedding matches (0-1 scale) */
export const SIMILARITY_THRESHOLD = 0.75;

/** Number of top similar results to retrieve from vector store */
export const TOP_K_RESULTS = 1;

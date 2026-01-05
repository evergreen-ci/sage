import { VoyageAIClient } from 'voyageai';
import { config } from '@/config';

/**
 * Voyage AI client instance configured with API key from environment.
 * Used for generating embeddings for semantic search and similarity matching.
 */
export const voyageClient = new VoyageAIClient({
  apiKey: config.aiModels.voyage.apiKey,
});

/**
 * Generate an embedding for a single text input.
 * @param text - The text to generate an embedding for
 * @returns The embedding vector as an array of numbers
 * @throws {Error} if embedding generation fails
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const response = await voyageClient.embed({
    input: text,
    model: config.aiModels.voyage.defaultModel,
  });

  const embedding = response.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error('Failed to generate embedding for text');
  }

  return embedding;
};
/**
 * Generate embeddings for multiple text inputs in a single batch request.
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of embedding vectors, one for each input text
 * @throws {Error} if embedding generation fails
 */
export const generateEmbeddings = async (
  texts: string[]
): Promise<number[][]> => {
  const response = await voyageClient.embed({
    input: texts,
    model: config.aiModels.voyage.defaultModel,
  });

  if (!response.data) {
    throw new Error('Failed to generate embeddings');
  }

  const embeddings = response.data
    .map(item => item.embedding)
    .filter((embedding): embedding is number[] => Boolean(embedding));

  if (embeddings.length !== texts.length) {
    throw new Error(
      `Expected ${texts.length} embeddings but received ${embeddings.length}`
    );
  }

  return embeddings;
};

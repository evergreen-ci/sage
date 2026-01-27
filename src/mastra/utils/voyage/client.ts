import { VoyageAIClient } from 'voyageai';
import { config } from '@/config';

/**
 * Custom error class for Voyage AI client errors.
 * Follows the CursorApiClientError pattern from the codebase.
 */
export class VoyageClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'VoyageClientError';
  }
}

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
 * @throws {VoyageClientError} if API key is not configured or embedding generation fails
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!config.aiModels.voyage.apiKey) {
    throw new VoyageClientError('Voyage API key not configured', 'NO_API_KEY');
  }

  try {
    const response = await voyageClient.embed({
      input: text,
      model: config.aiModels.voyage.defaultModel,
    });

    const embedding = response.data?.[0]?.embedding;

    if (!embedding) {
      throw new VoyageClientError(
        'No embedding returned from Voyage API',
        'NO_EMBEDDING'
      );
    }

    return embedding;
  } catch (error) {
    if (error instanceof VoyageClientError) {
      throw error;
    }
    throw new VoyageClientError(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'API_ERROR',
      error instanceof Error ? error : undefined
    );
  }
};

/**
 * Generate embeddings for multiple text inputs in a single batch request.
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of embedding vectors, one for each input text
 * @throws {VoyageClientError} if API key is not configured or embedding generation fails
 */
export const generateEmbeddings = async (
  texts: string[]
): Promise<number[][]> => {
  if (!config.aiModels.voyage.apiKey) {
    throw new VoyageClientError('Voyage API key not configured', 'NO_API_KEY');
  }

  try {
    const response = await voyageClient.embed({
      input: texts,
      model: config.aiModels.voyage.defaultModel,
    });

    if (!response.data) {
      throw new VoyageClientError(
        'No embeddings returned from Voyage API',
        'NO_EMBEDDING'
      );
    }

    const embeddings = response.data
      .map(item => item.embedding)
      .filter((embedding): embedding is number[] => Boolean(embedding));

    if (embeddings.length !== texts.length) {
      throw new VoyageClientError(
        `Expected ${texts.length} embeddings but received ${embeddings.length}`,
        'EMBEDDING_COUNT_MISMATCH'
      );
    }

    return embeddings;
  } catch (error) {
    if (error instanceof VoyageClientError) {
      throw error;
    }
    throw new VoyageClientError(
      `Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'API_ERROR',
      error instanceof Error ? error : undefined
    );
  }
};

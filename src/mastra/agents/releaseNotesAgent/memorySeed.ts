import { Memory } from '@mastra/memory';
import { memoryStore } from '@/mastra/utils/memory';
import { logger } from '@/utils/logger';

/**
 * Seeds product-specific memory with initial patterns.
 * This utility function can be used to manually seed patterns for a product
 * if needed. Note: Automatic seeding from published release notes is preferred.
 * @param product - Product name (e.g., 'ops-manager')
 * @param patterns - Array of patterns/guidelines to seed
 */
export const seedProductMemory = async (
  product: string,
  patterns: string[]
): Promise<void> => {
  const memory = new Memory({
    storage: memoryStore,
    options: {
      workingMemory: {
        scope: 'resource',
        enabled: true,
      },
    },
  });

  const resourceId = `release_notes:${product}`;
  const threadId = `${product}-seed-${Date.now()}`;

  try {
    // Create a seed thread to store initial patterns
    const thread = await memory.createThread({
      metadata: {
        product,
        seedPatterns: patterns,
        seededAt: new Date().toISOString(),
      },
      resourceId,
      threadId,
    });

    if (!thread) {
      logger.error('Failed to create seed thread', { product, resourceId });
      return;
    }

    // Store patterns as a message in the thread
    // This will be picked up by working memory template
    await memory.addMessage({
      threadId: thread.id,
      resourceId,
      type: 'text',
      role: 'user',
      content: `Product-specific patterns for ${product}:\n${patterns
        .map(p => `- ${p}`)
        .join('\n')}`,
    });

    logger.info('Seeded product memory', {
      product,
      resourceId,
      patternCount: patterns.length,
    });
  } catch (error) {
    logger.error('Error seeding product memory', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
            }
          : String(error),
      product,
      resourceId,
    });
  }
};

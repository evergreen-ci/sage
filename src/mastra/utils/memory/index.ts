import { MongoDBStore, MongoDBVector } from '@mastra/mongodb';
import { QUESTION_OWNERSHIP_INDEX } from '@/api-server/routes/completions/lumber/constants';
import { config } from '@/config';

export const memoryStore = new MongoDBStore({
  id: 'memoryStore',
  dbName: config.db.dbName,
  url: config.db.mongodbUri,
});

export const vectorStore = new MongoDBVector({
  id: 'vectorStore',
  dbName: config.db.dbName,
  uri: config.db.mongodbUri,
});

/**
 * Ensures all vector store indexes are created.
 * Should be called once during application startup.
 */
export const ensureVectorIndexes = async (): Promise<void> => {
  const indexes = await vectorStore.listIndexes();
  if (indexes.includes(QUESTION_OWNERSHIP_INDEX)) {
    return;
  }

  await vectorStore.createIndex({
    indexName: QUESTION_OWNERSHIP_INDEX,
    dimension: 1024,
  });
};

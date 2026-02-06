import { InMemoryStore } from '@mastra/core/storage';
import { MongoDBStore } from '@mastra/mongodb';
import { config } from '@/config';

const MONGODB_CONNECT_TIMEOUT_MS = 10_000;
const MONGODB_SERVER_SELECTION_TIMEOUT_MS = 10_000;

const isEval = process.env.BRAINTRUST_EVAL === 'true';

export const memoryStore = isEval
  ? new InMemoryStore({ id: 'memoryStore' })
  : new MongoDBStore({
      id: 'memoryStore',
      dbName: config.db.dbName,
      url: config.db.mongodbUri,
      options: {
        connectTimeoutMS: MONGODB_CONNECT_TIMEOUT_MS,
        serverSelectionTimeoutMS: MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      },
    });

import { MongoDBStore } from '@mastra/mongodb';
import { config } from '../../../config';

export const memoryStore = new MongoDBStore({
  dbName: config.db.dbName,
  url: config.db.mongodbUri,
});

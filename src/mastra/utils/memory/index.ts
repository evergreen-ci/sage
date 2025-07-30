import { MongoDBStore } from '@mastra/mongodb';
import { config } from '../../../config';
import { SAGE_DB } from '../../../db/constants';

export const memoryStore = new MongoDBStore({
  dbName: SAGE_DB,
  url: config.db.mongodbUri,
});

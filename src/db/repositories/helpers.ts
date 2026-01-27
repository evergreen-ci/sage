import { Collection, Document } from 'mongodb';
import { config } from '@/config';
import { db } from '@/db/connection';

/**
 * Gets a MongoDB collection by name with proper typing
 * @param collectionName - The name of the collection
 * @returns The MongoDB collection instance
 */
export const getCollection = <T extends Document>(
  collectionName: string
): Collection<T> =>
  db.getClient().db(config.db.dbName).collection<T>(collectionName);

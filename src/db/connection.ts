// TODO: DEVPROD-19199 create a connection to the database
import { MongoClient } from 'mongodb';
import { config } from '../config';
import logger from '../utils/logger';

/**
 * The Database class is a singleton that manages the connection to the MongoDB database.
 * It provides methods to connect, disconnect, and get the client instance.
 */
class Database {
  private client: MongoClient;
  private isConnected: boolean = false;

  constructor(private uri: string) {
    this.client = new MongoClient(uri);
  }

  /**
   * Attempts to connect if not already connected.
   * @returns The connected MongoClient instance
   */
  public async connect(): Promise<MongoClient> {
    if (this.isConnected) {
      return this.client;
    }

    try {
      logger.info('Connecting to MongoDB...');
      await this.client.connect();
      // Perform a ping to verify the connection
      await this.client.db('admin').command({ ping: 1 });
      this.isConnected = true;
      logger.info('Connected to MongoDB');
      return this.client;
    } catch (error) {
      logger.error('Error connecting to MongoDB', error);
      throw error;
    }
  }

  /**
   * Returns the connected client
   * @returns The connected MongoClient instance
   */
  public getClient(): MongoClient {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Closes the database connection
   * @returns void
   */
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    }
  }

  public async ping(): Promise<boolean> {
    try {
      await this.client.db('admin').command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  public async dbStats(): Promise<any> {
    return this.client.db('admin').command({ dbStats: 1 });
  }
}

export const db = new Database(config.db.mongodbUri);

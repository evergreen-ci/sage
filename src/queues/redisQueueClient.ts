import { createClient, type RedisClientType } from 'redis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

/**
 * Lightweight wrapper around a Redis client that handles connection
 * lifecycle management for queue operations.
 */
class RedisQueueClient {
  private client: RedisClientType | null = null;
  private connectPromise: Promise<void> | null = null;

  /**
   * Establishes a connection to Redis if one does not already exist.
   */
  private async connect(): Promise<void> {
    if (this.client?.isOpen) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    if (!config.redis.url) {
      throw new Error('REDIS_URL is not configured');
    }

    const client = createClient({ url: config.redis.url });
    client.on('error', error => {
      logger.error('Redis client error', error);
    });

    this.client = client;
    this.connectPromise = client
      .connect()
      .then(() => {
        logger.info('Connected to Redis queue');
      })
      .catch(error => {
        this.client = null;
        throw error;
      })
      .finally(() => {
        this.connectPromise = null;
      });

    return this.connectPromise;
  }

  /**
   * Gets an open Redis client, connecting if necessary.
   */
  private async getClient(): Promise<RedisClientType> {
    await this.connect();
    if (!this.client) {
      throw new Error('Redis client is unavailable');
    }
    return this.client;
  }

  /**
   * Enqueues a value onto the provided Redis list key.
   */
  public async enqueue(queueKey: string, value: string): Promise<void> {
    if (!queueKey) {
      throw new Error('Queue key is required');
    }
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      throw new Error('Cannot enqueue an empty value');
    }

    const client = await this.getClient();
    await client.lPush(queueKey, trimmedValue);
  }

  /**
   * Gracefully closes the Redis connection.
   */
  public async disconnect(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
      logger.info('Disconnected from Redis queue');
    }
    this.client = null;
  }
}

export const redisQueueClient = new RedisQueueClient();

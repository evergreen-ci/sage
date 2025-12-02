import { config } from '@/config';
import { redisQueueClient } from '@/queues/redisQueueClient';

/**
 * Handles enqueueing Jira issue keys into Redis for downstream processing.
 */
class JiraIssueQueue {
  private readonly queueKey = config.queues.jiraIssueKeyQueue;

  /**
   * Adds the provided issue key to the Redis queue.
   */
  public async enqueue(issueKey: string): Promise<void> {
    await redisQueueClient.enqueue(this.queueKey, issueKey);
  }

  /**
   * Tears down the Redis connection used by this queue.
   */
  public async shutdown(): Promise<void> {
    await redisQueueClient.disconnect();
  }
}

export const jiraIssueQueue = new JiraIssueQueue();

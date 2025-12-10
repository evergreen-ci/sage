import { Collection, ObjectId } from 'mongodb';
import { config } from '@/config';
import { db } from '@/db/connection';
import { JobRun, JobRunStatus, CreateJobRunInput } from '@/db/types';
import logger from '@/utils/logger';

const COLLECTION_NAME = 'job_runs';

/**
 * Gets the job_runs collection
 * @returns The MongoDB collection for job runs
 */
function getCollection(): Collection<JobRun> {
  return db
    .getClient()
    .db(config.db.dbName)
    .collection<JobRun>(COLLECTION_NAME);
}

/**
 * Ensures indexes are created for the job_runs collection
 * Should be called once during application startup
 */
export async function ensureIndexes(): Promise<void> {
  const collection = getCollection();

  // Index for looking up jobs by Jira ticket
  await collection.createIndex(
    { jiraTicketKey: 1 },
    { name: 'jiraTicketKey_idx' }
  );

  // Index for webhook lookups by Cursor agent ID
  await collection.createIndex(
    { cursorAgentId: 1 },
    { name: 'cursorAgentId_idx', sparse: true }
  );

  // Index for status-based queries (e.g., finding pending/running jobs)
  await collection.createIndex({ status: 1 }, { name: 'status_idx' });

  logger.info(`Indexes created for ${COLLECTION_NAME} collection`);
}

/**
 * Creates a new job run
 * @param input - The input data for creating a job run
 * @returns The created job run document
 */
export async function createJobRun(input: CreateJobRunInput): Promise<JobRun> {
  const collection = getCollection();
  const now = new Date();

  const jobRun: JobRun = {
    jiraTicketKey: input.jiraTicketKey,
    initiatedBy: input.initiatedBy,
    status: JobRunStatus.Pending,
    createdAt: now,
    updatedAt: now,
    metadata: input.metadata,
  };

  const result = await collection.insertOne(jobRun);
  jobRun._id = result.insertedId;

  logger.info(`Created job run for ticket ${input.jiraTicketKey}`, {
    jobRunId: result.insertedId.toString(),
  });

  return jobRun;
}

/**
 * Updates a job run's status and related fields
 * Handles all status transitions: running, completed, failed, cancelled
 * @param id - The job run ID (string or ObjectId)
 * @param status - The new status to set
 * @param errorMessage - Optional error message for failed status
 * @returns The updated job run document, or null if not found
 */
export async function updateJobRunStatus(
  id: string | ObjectId,
  status: JobRunStatus,
  errorMessage?: string
): Promise<JobRun | null> {
  const collection = getCollection();
  const objectId = typeof id === 'string' ? new ObjectId(id) : id;
  const now = new Date();

  const updateFields: Partial<JobRun> = {
    status,
    updatedAt: now,
  };

  // Set appropriate timestamps based on status
  if (status === JobRunStatus.Running) {
    updateFields.startedAt = now;
  } else if (
    status === JobRunStatus.Completed ||
    status === JobRunStatus.Failed ||
    status === JobRunStatus.Cancelled
  ) {
    updateFields.completedAt = now;
  }

  if (errorMessage) {
    updateFields.errorMessage = errorMessage;
  }

  const result = await collection.findOneAndUpdate(
    { _id: objectId },
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  if (result) {
    logger.info(`Updated job run ${objectId.toString()} to status ${status}`);
  }

  return result;
}

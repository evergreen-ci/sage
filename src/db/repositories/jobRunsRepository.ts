import { ObjectId } from 'mongodb';
import { JOB_RUNS_COLLECTION_NAME } from '@/db/repositories/constants';
import { getCollection } from '@/db/repositories/helpers';
import { JobRun, JobRunStatus, PrStatus, CreateJobRunInput } from '@/db/types';
import logger from '@/utils/logger';

/**
 * Ensures indexes are created for the job_runs collection
 * Should be called once during application startup
 */
export const ensureIndexes = async (): Promise<void> => {
  const collection = getCollection<JobRun>(JOB_RUNS_COLLECTION_NAME);

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

  logger.info(`Indexes created for ${JOB_RUNS_COLLECTION_NAME} collection`);
};

/**
 * Creates a new job run
 * @param input - The input data for creating a job run
 * @returns The created job run document
 */
export const createJobRun = async (
  input: CreateJobRunInput
): Promise<JobRun> => {
  const collection = getCollection<JobRun>(JOB_RUNS_COLLECTION_NAME);
  const now = new Date();

  const jobRun: JobRun = {
    jiraTicketKey: input.jiraTicketKey,
    initiatedBy: input.initiatedBy,
    assignee: input.assignee,
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
};

/**
 * Fields that can be updated on a job run
 */
export type JobRunUpdate = Partial<
  Pick<JobRun, 'status' | 'cursorAgentId' | 'errorMessage' | 'pr'>
>;

/**
 * Updates a job run with the provided fields
 * Handles status transitions with appropriate timestamps (startedAt, completedAt)
 * @param id - The job run ID (string or ObjectId)
 * @param updates - The fields to update
 * @returns The updated job run document, or null if not found
 */
export const updateJobRun = async (
  id: string | ObjectId,
  updates: JobRunUpdate
): Promise<JobRun | null> => {
  const collection = getCollection<JobRun>(JOB_RUNS_COLLECTION_NAME);
  const objectId = typeof id === 'string' ? new ObjectId(id) : id;
  const now = new Date();

  const updateFields: Partial<JobRun> = {
    ...updates,
    updatedAt: now,
  };

  // Set appropriate timestamps based on status
  if (updates.status === JobRunStatus.Running) {
    updateFields.startedAt = now;
  } else if (
    updates.status === JobRunStatus.Completed ||
    updates.status === JobRunStatus.Failed ||
    updates.status === JobRunStatus.FailedTimeout ||
    updates.status === JobRunStatus.Cancelled
  ) {
    updateFields.completedAt = now;
  }

  const result = await collection.findOneAndUpdate(
    { _id: objectId },
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  if (result) {
    const updatedFieldNames = Object.keys(updates);
    logger.info(
      `Updated job run ${objectId.toString()} with fields: ${updatedFieldNames.join(', ')}`,
      {
        jobRunId: objectId.toString(),
        updates,
      }
    );
  }

  return result;
};

/**
 * Finds the most recent job run for a given Jira ticket key
 * @param ticketKey - The Jira ticket key (e.g., 'PROJ-123')
 * @returns The most recent job run for the ticket, or null if not found
 */
export const findJobRunByTicketKey = async (
  ticketKey: string
): Promise<JobRun | null> => {
  const collection = getCollection<JobRun>(JOB_RUNS_COLLECTION_NAME);

  // Find the most recent job run for this ticket (by createdAt descending)
  return collection.findOne(
    { jiraTicketKey: ticketKey },
    { sort: { createdAt: -1 } }
  );
};

/**
 * Finds all job runs with Running status
 * Used by the Cursor agent status polling service to check for completed agents
 * @returns Array of job runs that are currently running
 */
export const findRunningJobRuns = async (): Promise<JobRun[]> => {
  const collection = getCollection<JobRun>(JOB_RUNS_COLLECTION_NAME);

  return collection
    .find({ status: JobRunStatus.Running })
    .sort({ startedAt: 1 })
    .toArray();
};

/**
 * Finds all completed job runs with open PRs
 * Used by the PR merge status polling service to check for merged PRs
 * @returns Array of completed job runs with open PRs
 */
export const findCompletedJobRunsWithOpenPRs = async (): Promise<JobRun[]> => {
  const collection = getCollection<JobRun>(JOB_RUNS_COLLECTION_NAME);

  return collection
    .find({
      status: JobRunStatus.Completed,
      'pr.status': PrStatus.Open,
      'pr.url': { $exists: true, $ne: null },
    })
    .sort({ completedAt: 1 })
    .toArray();
};

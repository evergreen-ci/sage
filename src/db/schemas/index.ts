import { ObjectId } from 'mongodb';
import { z } from 'zod';

/**
 * Zod schema for MongoDB ObjectId
 */
export const objectIdSchema = z.instanceof(ObjectId);

/**
 * Job run status enum values
 */
export enum JobRunStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  FailedTimeout = 'failed_timeout',
  Cancelled = 'cancelled',
}

/**
 * Zod schema for JobRunStatus
 */
export const jobRunStatusSchema = z.enum(JobRunStatus);

/**
 * PR status values from Jira Dev Status API
 */
export enum PrStatus {
  Open = 'OPEN',
  Merged = 'MERGED',
  Declined = 'DECLINED',
}

/**
 * Zod schema for JobRun documents stored in MongoDB
 */
export const jobRunSchema = z.object({
  _id: objectIdSchema.optional(),
  /** The Jira ticket key (e.g., "PROJ-123") */
  jiraTicketKey: z.string().min(1),
  /** Cursor agent ID once launched */
  cursorAgentId: z.string().optional(),
  /** Current status of the job */
  status: jobRunStatusSchema,
  /** User email who initiated the job (added the sage-bot label) */
  initiatedBy: z.email(),
  /** User email of the ticket assignee (whose API key will be used) */
  assignee: z.email().nullable(),
  /** Timestamp when the job was created */
  createdAt: z.date(),
  /** Timestamp when the job was last updated */
  updatedAt: z.date(),
  /** Timestamp when the job started processing */
  startedAt: z.date().optional(),
  /** Timestamp when the job completed (success or failure) */
  completedAt: z.date().optional(),
  /** Error message if the job failed */
  errorMessage: z.string().optional(),
  /** Additional metadata about the job */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Pull request information if a PR was created */
  pr: z
    .object({
      /** Full PR URL (e.g., 'https://github.com/owner/repo/pull/123') */
      url: z.string(),
      /** PR number extracted from the URL */
      number: z.number(),
      /** Repository in owner/repo format */
      repository: z.string(),
      /** PR status from Jira Dev Status API */
      status: z.enum(PrStatus),
      /** Last update timestamp from Jira Dev Status API (indicates when PR was merged/declined if not OPEN) */
      lastUpdate: z.date().optional(),
    })
    .optional(),
});

/**
 * Zod schema for creating a new job run (without auto-generated fields)
 */
export const createJobRunInputSchema = z.object({
  jiraTicketKey: z.string().min(1),
  initiatedBy: z.email(),
  assignee: z.email().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Zod schema for UserCredentials documents stored in MongoDB
 */
export const userCredentialsSchema = z.object({
  _id: objectIdSchema.optional(),
  /** User's email address (unique identifier) */
  email: z.email(),
  /** Encrypted Cursor API key for the user */
  cursorApiKey: z.string().min(1),
  /** Last 4 characters of the original API key (for display purposes) */
  keyLastFour: z.string().length(4),
  /** Timestamp when the credentials were created */
  createdAt: z.date(),
  /** Timestamp when the credentials were last updated */
  updatedAt: z.date(),
});

/**
 * Zod schema for creating/upserting user credentials (without auto-generated fields)
 */
export const createUserCredentialsInputSchema = z.object({
  email: z.email(),
  cursorApiKey: z.string().min(1),
});

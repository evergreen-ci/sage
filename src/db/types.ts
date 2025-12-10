import { ObjectId } from 'mongodb';

/**
 * Represents the status of a job run
 */
export enum JobRunStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/**
 * Represents a single job run for processing a Jira ticket
 */
export interface JobRun {
  _id?: ObjectId;
  /** The Jira ticket key (e.g., "PROJ-123") */
  jiraTicketKey: string;
  /** Cursor agent ID once launched */
  cursorAgentId?: string;
  /** Current status of the job */
  status: JobRunStatus;
  /** User email who initiated the job */
  initiatedBy: string;
  /** Timestamp when the job was created */
  createdAt: Date;
  /** Timestamp when the job was last updated */
  updatedAt: Date;
  /** Timestamp when the job started processing */
  startedAt?: Date;
  /** Timestamp when the job completed (success or failure) */
  completedAt?: Date;
  /** Error message if the job failed */
  errorMessage?: string;
  /** Additional metadata about the job */
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new job run (without auto-generated fields)
 */
export type CreateJobRunInput = Pick<JobRun, 'jiraTicketKey' | 'initiatedBy'> &
  Partial<Pick<JobRun, 'metadata'>>;

/**
 * Represents stored user credentials for accessing external services
 */
export interface UserCredentials {
  _id?: ObjectId;
  /** User's email address (unique identifier) */
  email: string;
  /** Encrypted Cursor API key for the user */
  cursorApiKey: string;
  /** Timestamp when the credentials were created */
  createdAt: Date;
  /** Timestamp when the credentials were last updated */
  updatedAt: Date;
}

/**
 * Input for creating/upserting user credentials (without auto-generated fields)
 */
export type CreateUserCredentialsInput = Pick<
  UserCredentials,
  'email' | 'cursorApiKey'
>;

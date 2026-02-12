import { z } from 'zod';
import {
  createJobRunInputSchema,
  createUserCredentialsInputSchema,
  jobRunSchema,
  userCredentialsSchema,
} from '@/db/schemas';

// Re-export schemas for convenience
export {
  createJobRunInputSchema,
  createUserCredentialsInputSchema,
  jobRunSchema,
  jobRunStatusSchema,
  objectIdSchema,
  userCredentialsSchema,
} from '@/db/schemas';

// Re-export enums
export { JobRunStatus, PRStatus } from '@/db/schemas';

/**
 * TypeScript type inferred from the JobRun schema
 */
export type JobRun = z.infer<typeof jobRunSchema>;

/**
 * TypeScript type for CreateJobRunInput
 */
export type CreateJobRunInput = z.infer<typeof createJobRunInputSchema>;

/**
 * TypeScript type inferred from the UserCredentials schema
 */
export type UserCredentials = z.infer<typeof userCredentialsSchema>;

/**
 * TypeScript type for CreateUserCredentialsInput
 */
export type CreateUserCredentialsInput = z.infer<
  typeof createUserCredentialsInputSchema
>;

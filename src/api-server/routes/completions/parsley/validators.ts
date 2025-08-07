import { z } from 'zod';
import { LogTypes } from 'types/parsley';
import { TaskLogOrigin } from 'types/task';

const evergreenTaskFileSchema = z.object({
  log_type: z.literal(LogTypes.EVERGREEN_TASK_FILE),
  task_id: z.string().min(1),
  execution: z.number().min(0),
});

const evergreenTaskLogsSchema = z.object({
  log_type: z.literal(LogTypes.EVERGREEN_TASK_LOGS),
  task_id: z.string().min(1),
  execution: z.number().min(0),
  origin: z.nativeEnum(TaskLogOrigin),
});

const evergreenTestLogsSchema = z.object({
  log_type: z.literal(LogTypes.EVERGREEN_TEST_LOGS),
  task_id: z.string().min(1),
  execution: z.number().min(0),
  test_id: z.string().min(1),
});

/**
 * Validates the log metadata for the add message route to ensure is is passed the correct type of log metadata for task logs
 * @param logMetadata - The log metadata to validate
 * @returns The validated log metadata
 */
export const logMetadataSchema = z.discriminatedUnion('log_type', [
  evergreenTaskFileSchema,
  evergreenTaskLogsSchema,
  evergreenTestLogsSchema,
]);

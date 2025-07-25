/**
 * The type of log that the user is requesting
 */
export enum LogTypes {
  EVERGREEN_TASK_FILE = 'EVERGREEN_TASK_FILE',
  EVERGREEN_TASK_LOGS = 'EVERGREEN_TASK_LOGS',
  EVERGREEN_TEST_LOGS = 'EVERGREEN_TEST_LOGS',
  EVERGREEN_COMPLETE_LOGS = 'EVERGREEN_COMPLETE_LOGS',
}

/**
 * The origin of the log for task logs
 */
export enum TaskLogOrigin {
  Agent = 'agent',
  System = 'system',
  Task = 'task',
  All = 'all',
}

import queryString from 'query-string';
import { z } from 'zod';
import { Task as TaskType } from 'gql/generated/types';
import { LogTypes } from 'types/parsley';
import { stringifyQuery } from 'utils/query-string';
import { config } from '../../config';
import { logMetadataSchema } from './logMetadata';

const { evergreenURL } = config.evergreen;
/**
 *
 * @param taskID - the task ID
 * @param execution - the execution number of the task
 * @param testID - the test ID of the test
 * @param options - the options for the test log
 * @param options.text - returns the raw test log
 * @param options.groupID - the group ID
 * @returns an Evergreen URL of the format `/test_log/${taskID}/${execution}?test_name=${testID}&group_id=${groupID}text=true`
 */
const getEvergreenTestLogURL = (
  taskID: string,
  execution: string | number,
  testID: string,
  options: { text?: boolean; groupID?: string }
) => {
  const { groupID, text } = options;
  const params = {
    group_id: groupID,
    test_name: testID,
    text,
  };
  return `${evergreenURL}/test_log/${taskID}/${execution}?${stringifyQuery(
    params
  )}`;
};

export enum Origin {
  Agent = 'agent',
  System = 'system',
  Task = 'task',
  All = 'all',
}

const getEvergreenTaskLogURL = (
  logLinks: TaskType['logs'],
  origin: string,
  params: { priority?: boolean; text?: boolean } = {}
) => {
  const url =
    {
      [Origin.Agent]: logLinks.agentLogLink,
      [Origin.System]: logLinks.systemLogLink,
      [Origin.Task]: logLinks.taskLogLink,
      [Origin.All]: logLinks.allLogLink,
    }[origin] ?? '';
  return queryString.stringifyUrl({ query: params, url });
};

const mapOriginToType = {
  [Origin.Agent]: 'E',
  [Origin.All]: 'ALL',
  [Origin.System]: 'S',
  [Origin.Task]: 'T',
};

/**
 * constructEvergreenTaskLogURL constructs an Evergreen task link as a fallback using the task's parameters.
 * @param taskID - the task ID
 * @param execution - the execution number of the task
 * @param origin - the origin of the log
 * @param options - the options for the task log
 * @param options.priority - returned log includes a priority prefix on each line
 * @param options.text - returns the raw log associated with the task
 * @returns an Evergreen URL of the format `/task/${taskID}/${execution}?type=${OriginToType[origin]}&text=true`
 */
const constructEvergreenTaskLogURL = (
  taskID: string,
  execution: string | number,
  origin: string,
  options: { priority?: boolean; text?: boolean }
) => {
  const { priority, text } = options;
  const params = {
    priority,
    text,
    type: mapOriginToType[origin as Origin] || undefined,
  };
  return `${evergreenURL}/task_log_raw/${taskID}/${execution}?${stringifyQuery(
    params
  )}`;
};

/**
 *
 * @param taskID - the task ID
 * @param execution - the execution number of the task
 * @param fileName - the name of the file in Evergreen
 * @returns an Evergreen URL of the format `/task_file_raw/${taskID}/${execution}/${fileName}`
 */
const getEvergreenTaskFileURL = (
  taskID: string,
  execution: string | number,
  fileName: string
) => `${evergreenURL}/task_file_raw/${taskID}/${execution}/${fileName}`;

/**
 * getEvergreenCompleteLogsURL constructs an Evergreen URL to download complete logs for a task.
 * @param taskID - the task ID
 * @param execution - the execution number of the task
 * @param groupID - the group ID of the task
 * @returns an Evergreen URL of the format /rest/v2/tasks/${taskID}/build/TestLogs/${groupID}?execution=${execution}
 */
const getEvergreenCompleteLogsURL = (
  taskID: string,
  execution: string | number,
  groupID: string
) =>
  `${evergreenURL}/rest/v2/tasks/${taskID}/build/TestLogs/${groupID}%2F?execution=${execution}`;

const generateLogURL = (logMetadata: z.infer<typeof logMetadataSchema>) => {
  switch (logMetadata.log_type) {
    case LogTypes.EVERGREEN_TASK_FILE:
      return getEvergreenTaskFileURL(
        logMetadata.task_id,
        logMetadata.execution,
        logMetadata.fileName
      );
    case LogTypes.EVERGREEN_TASK_LOGS:
      return constructEvergreenTaskLogURL(
        logMetadata.task_id,
        logMetadata.execution,
        logMetadata.origin,
        {
          text: true,
        }
      );
    case LogTypes.EVERGREEN_TEST_LOGS:
      return getEvergreenTestLogURL(
        logMetadata.task_id,
        logMetadata.execution,
        logMetadata.test_id,
        {
          text: true,
          groupID: logMetadata.group_id ?? undefined,
        }
      );
    default:
      throw new Error('Invalid log metadata');
  }
};
export {
  constructEvergreenTaskLogURL,
  getEvergreenCompleteLogsURL,
  getEvergreenTaskFileURL,
  getEvergreenTaskLogURL,
  getEvergreenTestLogURL,
  generateLogURL,
};

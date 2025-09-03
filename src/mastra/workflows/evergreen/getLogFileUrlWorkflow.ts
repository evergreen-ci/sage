import { createWorkflow, createStep } from '@mastra/core';
import { z } from 'zod';
import { logMetadataSchema } from '../../../constants/parsley/logMetadata';
import {
  constructEvergreenTaskLogURL,
  getEvergreenTaskFileURL,
} from '../../../constants/parsley/logURLTemplates';
import { LogTypes } from '../../../types/parsley';
import { getTaskTestsTool } from '../../tools/evergreen';

const step1ValidateLogFileUrl = createStep({
  id: 'validate-log-file-url',
  description: 'Validate the log file url',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
  }),
  outputSchema: z.object({
    logType: z.nativeEnum(LogTypes),
    logMetadata: logMetadataSchema,
  }),
  execute: async ({ inputData }) => {
    const { logMetadata } = inputData;
    return {
      logType: logMetadata.log_type,
      logMetadata: logMetadata,
    };
  },
});

const step2SimpleLogFileUrl = createStep({
  id: 'simple-log-file-url',
  description: 'Get the log file url from a template string',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
    logType: z.nativeEnum(LogTypes),
  }),
  outputSchema: z.object({
    logFileUrl: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { logMetadata } = inputData;
    switch (logMetadata.log_type) {
      case LogTypes.EVERGREEN_TASK_FILE:
        return {
          logFileUrl: getEvergreenTaskFileURL(
            logMetadata.task_id,
            logMetadata.execution,
            logMetadata.fileName
          ),
        };
      case LogTypes.EVERGREEN_TASK_LOGS:
        return {
          logFileUrl: constructEvergreenTaskLogURL(
            logMetadata.task_id,
            logMetadata.execution,
            logMetadata.origin,
            {
              text: true,
            }
          ),
        };
      default:
        throw new Error('Unsupported log type for this workflow');
    }
  },
});

const getTestResultsStep = createStep({
  id: 'get-test-results',
  description: 'Get the test results for a test log',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
    logType: z.nativeEnum(LogTypes),
  }),
  outputSchema: z.object({
    getTestResultsStepOutput: getTaskTestsTool.outputSchema,
    testId: z.string(),
    groupId: z.string().optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { logMetadata } = inputData;
    if (logMetadata.log_type !== LogTypes.EVERGREEN_TEST_LOGS) {
      throw new Error('Log metadata is not a test log');
    }
    console.log('filters on', logMetadata.test_id, logMetadata.group_id);
    const getTestResultsStepOutput = await getTaskTestsTool.execute({
      context: {
        id: logMetadata.task_id,
        execution: logMetadata.execution,
        groupId: logMetadata.group_id,
      },
      runtimeContext: runtimeContext,
    });
    return {
      getTestResultsStepOutput: getTestResultsStepOutput,
      testId: logMetadata.test_id,
      groupId: logMetadata.group_id,
    };
  },
});

const getFinalTestLogUrl = createStep({
  id: 'get-final-test-log-url',
  description: 'Get the final test log url',
  inputSchema: getTestResultsStep.outputSchema,
  outputSchema: z.object({
    logFileUrl: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { getTestResultsStepOutput, testId } = inputData;
    if (!getTestResultsStepOutput) {
      throw new Error('Task is not defined');
    }
    let logFileUrl = '';
    getTestResultsStepOutput.task?.tests.testResults.forEach(testResult => {
      if (testResult.id === testId) {
        logFileUrl = testResult.logs.urlRaw ?? '';
      }
    });
    if (logFileUrl === '') {
      throw new Error('Test log url not found');
    }
    return {
      logFileUrl: logFileUrl,
    };
  },
});

const getDynamicTestLogUrlWorkflow = createWorkflow({
  id: 'get-dynamic-test-log-url',
  description: 'Get the log file url for a test log',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
    logType: z.nativeEnum(LogTypes),
  }),
  outputSchema: z.object({
    logFileUrl: z.string(),
  }),
})
  .then(getTestResultsStep)
  .then(getFinalTestLogUrl)
  .commit();

const simpleLogTypes = [
  LogTypes.EVERGREEN_TASK_FILE,
  LogTypes.EVERGREEN_TASK_LOGS,
];
const getLogFileUrlWorkflow = createWorkflow({
  id: 'get-log-file-url',
  description: 'Get the log file url',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
  }),
  outputSchema: z.object({
    logFileUrl: z.string(),
  }),
})
  .then(step1ValidateLogFileUrl)
  .branch([
    [
      async ({ inputData }) => simpleLogTypes.includes(inputData.logType),
      step2SimpleLogFileUrl,
    ],
    [
      async ({ inputData }) =>
        inputData.logType === LogTypes.EVERGREEN_TEST_LOGS,
      getDynamicTestLogUrlWorkflow,
    ],
  ])
  .commit();

export default getLogFileUrlWorkflow;

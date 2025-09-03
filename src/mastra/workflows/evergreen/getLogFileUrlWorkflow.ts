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
    logMetadata: logMetadataSchema,
  }),
  execute: async ({ inputData }) => {
    const { logMetadata } = inputData;
    const result = logMetadataSchema.safeParse(logMetadata);
    if (!result.success) {
      throw new Error('Invalid log metadata');
    }
    return {
      logMetadata: result.data,
    };
  },
});

const step2SimpleLogFileUrl = createStep({
  id: 'simple-log-file-url',
  description: 'Get the log file url from a template string',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
  }),
  outputSchema: z.string(),
  execute: async ({ inputData }) => {
    const { logMetadata } = inputData;
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

const processTestResultsStep = createStep({
  id: 'get-final-test-log-url',
  description: 'Get the final test log url',
  inputSchema: getTestResultsStep.outputSchema,
  outputSchema: z.string(),
  execute: async ({ inputData }) => {
    const { getTestResultsStepOutput, testId } = inputData;
    if (!getTestResultsStepOutput) {
      throw new Error('Task is not defined');
    }
    let logFileUrl = '';
    const testResult = getTestResultsStepOutput.task?.tests.testResults.find(
      tr => tr.id === testId
    );
    if (!testResult) {
      throw new Error('Test result not found');
    }
    logFileUrl = testResult.logs.urlRaw ?? '';
    if (logFileUrl === '') {
      throw new Error('Test log url not found');
    }
    return logFileUrl;
  },
});

const step2GetDynamicTestLogUrlWorkflow = createWorkflow({
  id: 'get-dynamic-test-log-url',
  description: 'Get the log file url for a test log',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
  }),
  outputSchema: z.string(),
})
  .then(getTestResultsStep)
  .then(processTestResultsStep)
  .commit();

const step3FinalLogFileUrl = createStep({
  id: 'final-log-file-url',
  description: 'Final log file url',
  inputSchema: z.object({
    'simple-log-file-url': z.string(),
    'get-dynamic-test-log-url': z.string(),
  }),
  outputSchema: z.string(),
  execute: async ({ inputData }) => {
    const {
      ['get-dynamic-test-log-url']: dynamicTestLogUrl,
      ['simple-log-file-url']: simpleLogFileUrl,
    } = inputData;
    if (simpleLogFileUrl && dynamicTestLogUrl) {
      throw new Error(
        'Both simple log file url and dynamic test log url found for the same log metadata. This is not possible.'
      );
    }
    if (simpleLogFileUrl) {
      return simpleLogFileUrl;
    }
    if (dynamicTestLogUrl) {
      return dynamicTestLogUrl;
    }

    throw new Error('No log file url found');
  },
});

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
  outputSchema: z.string(),
})
  .then(step1ValidateLogFileUrl)
  .branch([
    [
      async ({ inputData }) =>
        simpleLogTypes.includes(inputData.logMetadata.log_type),
      step2SimpleLogFileUrl,
    ],
    [
      async ({ inputData }) =>
        inputData.logMetadata.log_type === LogTypes.EVERGREEN_TEST_LOGS,
      step2GetDynamicTestLogUrlWorkflow,
    ],
  ])
  .then(step3FinalLogFileUrl)
  .commit();

export default getLogFileUrlWorkflow;

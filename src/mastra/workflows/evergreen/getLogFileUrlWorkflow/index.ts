import { createWorkflow, createStep } from '@mastra/core';
import { wrapTraced } from 'braintrust';
import { z } from 'zod';
import { logMetadataSchema } from '../../../../constants/parsley/logMetadata';
import {
  constructEvergreenTaskLogURL,
  getEvergreenTaskFileURL,
} from '../../../../constants/parsley/logURLTemplates';
import { LogTypes } from '../../../../types/parsley';
import { getTaskTestsTool } from '../../../tools/evergreen';

/** Log types that can be turned into URLs directly from metadata */
const DIRECT_LOG_TYPES = [
  LogTypes.EVERGREEN_TASK_FILE,
  LogTypes.EVERGREEN_TASK_LOGS,
] as const;

/** 1) Validate the incoming metadata */
const validateLogMetadata = createStep({
  id: 'validateLogMetadata',
  description: 'Validate log metadata with zod',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
  }),
  outputSchema: z.object({
    logMetadata: logMetadataSchema,
  }),
  execute: wrapTraced(async ({ inputData }) => {
    const result = logMetadataSchema.safeParse(inputData.logMetadata);
    if (!result.success) {
      throw new Error('Invalid log metadata');
    }
    return { logMetadata: result.data };
  }),
});

/** 2a) Build direct URL for task file / task logs */
const buildDirectLogUrl = createStep({
  id: 'buildDirectLogUrl',
  description: 'Construct a direct log URL for task files or task logs',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
  }),
  outputSchema: z.string(),
  execute: wrapTraced(async ({ inputData }) => {
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
          { text: true }
        );

      default:
        throw new Error('Unsupported log type for direct URL construction');
    }
  }),
});

/** 2b-i) Fetch test results when the log is a test log */
const fetchTestResultsForTestLog = createStep({
  id: 'fetchTestResultsForTestLog',
  description: 'Fetch Evergreen test results for a given test log',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
  }),
  outputSchema: z.object({
    testResults: getTaskTestsTool.outputSchema,
    testId: z.string(),
    groupId: z.string().optional(),
  }),
  execute: wrapTraced(async ({ inputData, runtimeContext }) => {
    const { logMetadata } = inputData;

    if (logMetadata.log_type !== LogTypes.EVERGREEN_TEST_LOGS) {
      throw new Error('Expected test log metadata but received a non-test log');
    }

    const testResults = await getTaskTestsTool.execute({
      context: {
        id: logMetadata.task_id,
        execution: logMetadata.execution,
        groupId: logMetadata.group_id,
      },
      runtimeContext,
    });

    return {
      testResults,
      testId: logMetadata.test_id,
      groupId: logMetadata.group_id,
    };
  }),
});

/** 2b-ii) Derive the actual test log URL from fetched results */
const deriveTestLogUrl = createStep({
  id: 'deriveTestLogUrl',
  description: 'Resolve the final test log URL for a specific test id',
  inputSchema: fetchTestResultsForTestLog.outputSchema,
  outputSchema: z.string(),
  execute: wrapTraced(async ({ inputData }) => {
    const { testId, testResults } = inputData;

    const results = testResults.task?.tests?.testResults ?? [];
    const match = results.find((tr: { id: any }) => {
      if (!tr) return false;
      const idMatches = tr.id === testId;
      return idMatches;
    });

    if (!match) {
      throw new Error('Test result not found for provided testId');
    }

    const url = match.logs?.urlRaw || '';
    if (!url) {
      throw new Error('No test log URL available on the matched test result');
    }
    return url;
  }),
});

/** Sub-workflow for test logs */
const testLogUrl = createWorkflow({
  id: 'testLogUrl',
  description:
    'Resolve the test log URL by fetching results and selecting the right entry',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
  }),
  outputSchema: z.string(),
})
  .then(fetchTestResultsForTestLog)
  .then(deriveTestLogUrl)
  .commit();

/** 3) Choose which URL to return based on the branch that ran */
const chooseLogUrl = createStep({
  id: 'chooseLogUrl',
  description:
    'Select the resolved log URL from either the direct or test branch',
  inputSchema: z.object({
    buildDirectLogUrl: z.string(),
    testLogUrl: z.string(),
  }),
  outputSchema: z.string(),
  execute: wrapTraced(async ({ inputData }) => {
    const { buildDirectLogUrl: directUrl, testLogUrl: testUrl } = inputData;

    if (directUrl && testUrl) {
      throw new Error(
        'Both direct and test log URLs were produced. Only one branch should resolve.'
      );
    }
    if (directUrl) return directUrl;
    if (testUrl) return testUrl;

    throw new Error('No log URL resolved from the provided metadata');
  }),
});

/**
 * Top-level workflow
 * @param root0 - The input data
 * @param root0.inputData - The input data
 * @returns The log file URL
 */
const resolveLogFileUrl = createWorkflow({
  id: 'resolve-log-file-url',
  description: 'Resolve a log file URL from Evergreen log metadata',
  inputSchema: z.object({
    logMetadata: logMetadataSchema,
  }),
  outputSchema: z.string(),
})
  .then(validateLogMetadata)
  .branch([
    [
      async ({ inputData }) =>
        DIRECT_LOG_TYPES.includes(
          inputData.logMetadata.log_type as (typeof DIRECT_LOG_TYPES)[number]
        ),
      buildDirectLogUrl,
    ],
    [
      async ({ inputData }) =>
        inputData.logMetadata.log_type === LogTypes.EVERGREEN_TEST_LOGS,
      testLogUrl,
    ],
  ])
  .then(chooseLogUrl)
  .commit();

export default resolveLogFileUrl;

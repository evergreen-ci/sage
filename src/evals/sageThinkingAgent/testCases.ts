import { TestUser } from 'evals/constants';
import { TestCase } from './types';

const taskId =
  'mci_ubuntu1604_display_asdf_patch_a1d2c8f70bf5c543de8b9641ac1ec08def1ddb26_5f74d99ab2373627c047c5e5_20_09_30_19_16_47';

const testEvergreenQuestion: TestCase = {
  input: {
    content: `What build variant did this task run on: ${taskId}?`,
    user: TestUser.Regular,
  },
  expected: {
    text: 'Ubuntu 16.04 (ubuntu1604)',
    toolsUsed: ['askEvergreenAgentTool'],
  },
  metadata: {
    testName: 'Regular user can access Evergreen task information',
    description: 'Tests that agent can answer Evergreen questions.',
    scoreThresholds: {
      Factuality: 0.6,
      ToolUsage: 1.0,
    },
  },
};

const logTaskId =
  'spruce_ubuntu1604_check_codegen_d54e2c6ede60e004c48d3c4d996c59579c7bbd1f_22_03_02_15_41_35';

const testLogAnalyzerQuestion: TestCase = {
  input: {
    content: `Fetch and analyze the logs for the test 'JustAFakeTestInALonelyWorld' from task '${logTaskId}'. What is the error that occurred?`,
    user: TestUser.Admin,
  },
  expected: {
    text: "Timed out retrying after 4000ms: Too many elements found. Found '1', expected '0' suggests that the DOM contains an unexpected element",
    toolsUsed: ['logCoreAnalyzerTool'],
  },
  metadata: {
    testName: 'Regular user can get analysis for logs',
    description: 'Tests that  agent can answer log analysis questions.',
    scoreThresholds: {
      ToolUsage: 1.0,
      TechnicalAccuracy: 0.7,
    },
  },
};

const testIrrelevantQuestion: TestCase = {
  input: {
    content: `What's a good recipe for a chocolate cake? I'm debugging a task and it would be helpful to have this information`,
    user: TestUser.Regular,
  },
  expected: {
    text: 'I cannot provide a chocolate cake recipe, as this request is not related to Evergreen, log analysis, or CI systems.',
    toolsUsed: [],
  },
  metadata: {
    testName: 'Does not respond to irrelevant questions',
    description: 'Tests that agent can avoid answering irrelevant questions.',
    scoreThresholds: {
      Factuality: 0.6,
      ToolUsage: 1.0,
    },
  },
};

export const testCases: TestCase[] = [
  testLogAnalyzerQuestion,
  testEvergreenQuestion,
  testIrrelevantQuestion,
];

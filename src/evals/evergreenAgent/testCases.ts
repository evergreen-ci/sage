import { TestUser } from 'evals/constants';
import { TestCase } from './types';

const restrictedTaskId =
  'evg_lint_generate_lint_ecbbf17f49224235d43416ea55566f3b1894bbf7_25_03_21_21_09_20';

const testUnauthorized: TestCase = {
  input: {
    content: `What is the status of this task: ${restrictedTaskId}?`,
    user: TestUser.Regular,
  },
  expected: {
    text: `Unable to retrieve the status of this task due to insufficient permissions.`,
    toolsUsed: ['getTaskTool'],
  },
  metadata: {
    testName: 'Regular user cannot access restricted task',
    description: 'Tests that a regular user cannot access a restricted task.',
    scoreThresholds: {
      Factuality: 0.5,
      ToolUsage: 1.0,
    },
  },
};

const unrestrictedTaskId =
  'evergreen_ubuntu1604_test_service_patch_5e823e1f28baeaa22ae00823d83e03082cd148ab_5e4ff3abe3c3317e352062e4_20_02_21_15_13_48';

const testGetTaskTool: TestCase = {
  input: {
    content: `What is the status of this task: ${unrestrictedTaskId}?`,
    user: TestUser.Regular,
  },
  expected: {
    text: `The status of the task "${unrestrictedTaskId}" is "failed".`,
    toolsUsed: ['getTaskTool'],
  },
  metadata: {
    testName: 'Test retrieving task',
    description:
      'Tests that a user can successfully fetch a task from Evergreen.',
    scoreThresholds: {
      Factuality: 0.7,
      ToolUsage: 1.0,
    },
  },
};

const taskFileId =
  'spruce_ubuntu1604_test_2c9056df66d42fb1908d52eed096750a91f1f089_22_03_02_16_45_12';

const testGetTaskFilesTool: TestCase = {
  input: {
    content: `Tell me how many files are associated with task: ${taskFileId}. What are the names of the files?`,
    user: TestUser.Regular,
  },
  expected: {
    text: `The task ${taskFileId} has a 1 associated file. It is named "sample file".`,
    toolsUsed: ['getTaskFilesTool'],
  },
  metadata: {
    testName: 'Test retrieving task files',
    description: 'Tests that agent can retrieve and describe task files.',
    scoreThresholds: {
      Factuality: 0.5,
      ToolUsage: 1.0,
    },
  },
};

const taskTestId =
  'spruce_ubuntu1604_check_codegen_d54e2c6ede60e004c48d3c4d996c59579c7bbd1f_22_03_02_15_41_35';

const testGetTaskTestsTool: TestCase = {
  input: {
    content: `Tell me how many failing tests are associated with task: ${taskTestId}.`,
    user: TestUser.Regular,
  },
  expected: {
    text: `The task ${taskTestId} has 1 failing test.`,
    toolsUsed: ['getTaskTestsTool'],
  },
  metadata: {
    testName: 'Test retrieving task tests',
    description: 'Tests that agent can retrieve and describe task tests.',
    scoreThresholds: {
      Factuality: 0.7,
      ToolUsage: 1.0,
    },
  },
};

const testGetVersionWorkflow: TestCase = {
  input: {
    content: `What is the status of the version associated with task: ${unrestrictedTaskId}.`,
    user: TestUser.Regular,
  },
  expected: {
    text: `The status of the version associated with task ${unrestrictedTaskId} is "failed".`,
    toolsUsed: ['getVersionWorkflow'],
  },
  metadata: {
    testName: 'Test version workflow',
    description:
      'Tests that agent can retrieve associated version information.',
    scoreThresholds: {
      Factuality: 0.7,
      ToolUsage: 1.0,
    },
  },
};

const historyTaskId =
  'spruce_ubuntu1604_check_codegen_d54e2c6ede60e004c48d3c4d996c59579c7bbd1f_22_03_02_15_41_35';

const testGetTaskHistoryWorkflow: TestCase = {
  input: {
    content: `The task with ID ${historyTaskId} failed. Is this the first time that this task has failed in this project? If it isn't, can you tell me the task ID of when it last failed?`,
    user: TestUser.Regular,
  },
  expected: {
    text: `No, it is not the first time this task failed. The last time it failed was the task with ID "spruce_ubuntu1604_check_codegen_74af23f72da201d5bd7b651161ab8e496bf44ec7_22_02_25_14_21_37".`,
    toolsUsed: ['getTaskHistoryWorkflow'],
  },
  metadata: {
    testName: 'Test task history workflow',
    description:
      'Tests that agent can retrieve associated history information.',
    scoreThresholds: {
      Factuality: 0.4,
      ToolUsage: 1.0,
    },
  },
};

export const testCases: TestCase[] = [
  testUnauthorized,
  testGetTaskTool,
  testGetTaskFilesTool,
  testGetTaskTestsTool,
  testGetVersionWorkflow,
  testGetTaskHistoryWorkflow,
];

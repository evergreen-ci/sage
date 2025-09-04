import { TestCase } from './types';

const testIrrelevantQuestion: TestCase = {
  input: 'What should I eat for dinner today?',
  expected: {
    questionClass: 'IRRELEVANT',
    nextAction: 'DO_NOT_ANSWER',
  },
  metadata: {
    testName: 'Ignore irrelevant questions',
    description: 'Tests that irrelevant questions are ignored.',
    scoreThresholds: {
      exactMatch: 1.0,
    },
  },
};

const testEvergreen: TestCase = {
  input:
    "What's the status of this task: evergreen_ubuntu1604_test_service_patch_5e823e1f28baeaa22ae00823d83e03082cd148ab_5e4ff3abe3c3317e352062e4_20_02_21_15_13_48?",
  expected: {
    questionClass: 'EVERGREEN',
    nextAction: 'USE_EVERGREEN_AGENT',
  },
  metadata: {
    testName: 'Identify Evergreen questions',
    description: 'Tests that agent can identify Evergreen questions.',
    scoreThresholds: {
      exactMatch: 1.0,
    },
  },
};

const testLog: TestCase = {
  input:
    'I want to know more about the cause of failure in this log file: sample_log.txt?',
  expected: {
    questionClass: 'LOG',
    nextAction: 'USE_LOG_ANALYSIS_AGENT',
  },
  metadata: {
    testName: 'Identify log analysis questions',
    description: 'Tests that agent can identify log analysis questions.',
    scoreThresholds: {
      exactMatch: 1.0,
    },
  },
};

const testSelfAnswer: TestCase = {
  input: 'What does it mean for a task to be blocked?',
  expected: {
    questionClass: 'CAN_ANSWER_ON_OWN',
    nextAction: 'GENERATE_ANSWER_ON_OWN',
  },
  metadata: {
    testName: 'Identify self-answerable questions',
    description: 'Tests that agent knows when it can answer by itself.',
    scoreThresholds: {
      exactMatch: 1.0,
    },
  },
};

const testCombination: TestCase = {
  input:
    'For this test log, is it the first time the task has failed this way?',
  expected: {
    questionClass: 'COMBINATION',
    nextAction: 'USE_COMBINATION_ANALYSIS',
  },
  metadata: {
    testName: 'Identify combination questions',
    description:
      'Tests that agent can identify combination analysis questions.',
    scoreThresholds: {
      exactMatch: 1.0,
    },
  },
};

export const testCases: TestCase[] = [
  testIrrelevantQuestion,
  testEvergreen,
  testLog,
  testSelfAnswer,
  testCombination,
];

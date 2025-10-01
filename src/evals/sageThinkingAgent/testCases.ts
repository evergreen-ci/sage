import { initDataset } from 'braintrust';
import { PROJECT_NAME } from 'evals/constants';
import { TestCase } from './types';

export const getTestCases = async () => {
  const dataset = initDataset(PROJECT_NAME, {
    dataset: 'sage_thinking_agent_dataset',
  });
  const testCases: TestCase[] = [];
  for await (const row of dataset) {
    const testCase: TestCase = {
      input: row.input,
      expected: row.expected,
      metadata: row.metadata,
    };
    testCases.push(testCase);
  }
  console.log(`Loaded ${testCases.length} test cases from Braintrust`);
  return testCases;
};

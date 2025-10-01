import { initDataset } from 'braintrust';
import { PROJECT_NAME } from 'evals/constants';
import { TestCase } from './types';

export const getTestCases = async () => {
  const dataset = initDataset(PROJECT_NAME, {
    dataset: 'evergreen_agent_dataset',
  });
  const testCases: TestCase[] = [];
  for await (const row of dataset) {
    testCases.push(row as TestCase);
  }
  console.log(`Loaded ${testCases.length} test cases from Braintrust`);
  return testCases;
};

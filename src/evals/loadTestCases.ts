import { initDataset } from 'braintrust';
import { PROJECT_NAME } from 'evals/constants';

export const loadTestCases = async <TestCase>(datasetName: string) => {
  const dataset = initDataset(PROJECT_NAME, {
    dataset: datasetName,
  });
  const testCases: TestCase[] = [];
  for await (const row of dataset) {
    testCases.push(row as TestCase);
  }
  console.log(`Loaded ${testCases.length} test cases from Braintrust`);
  return testCases;
};

import { initDataset } from 'braintrust';
import { PROJECT_NAME } from 'evals/constants';

/**
 * Loads test cases from the Braintrust dataset. Visit Braintrust to view and create new datasets.
 * @param datasetName - name of the dataset to load
 * @returns an array of test cases to run in evals
 */
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

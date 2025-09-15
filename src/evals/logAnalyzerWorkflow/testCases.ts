import { Attachment, initDataset } from 'braintrust';
import { TestCase } from './types';

export const getTestCases = async () => {
  const dataset = initDataset('sage-prod', { dataset: 'small_file_dataset' });
  const testCases: TestCase[] = [];
  for await (const row of dataset) {
    const input = row.input as { file: Attachment };
    const testCase: TestCase = {
      input: {
        file: input.file,
        analysisContext:
          'Analyze the log file and provide a detailed analysis of the log file.',
      },
      expected: {
        summary: row.expected,
        markdown: '',
      },
      metadata: {
        testName: row.metadata.testName,
        description: row.metadata.description,
        scoreThresholds: {
          Factuality: 0.7,
          TechnicalAccuracy: 0.7,
        },
      },
    };
    testCases.push(testCase);
  }

  // Only get the first entry from the dataset

  return testCases;
};

import { Attachment, initDataset } from 'braintrust';
import { TestCase } from './types';

export const getTestCases = async () => {
  const dataset = initDataset('sage-prod', {
    dataset: 'log_analysis_dataset_for_testing',
  });
  const testCases: TestCase[] = [];
  for await (const row of dataset) {
    const input = row.input as { file: Attachment };

    const testCase: TestCase = {
      input: {
        file: input.file,
        analysisContext:
          'Analyze the log file and attempt to identify the root cause of the failure.',
      },
      expected: {
        summary: row.expected,
        markdown: '',
      },
      metadata: {
        testName: `Analysis of ${input.file.reference.filename}`,
        description: row.metadata.description,
        scoreThresholds: {
          Factuality: 0.6,
          TechnicalAccuracy: 0.7,
        },
      },
    };
    testCases.push(testCase);
  }
  console.log(`Loaded ${testCases.length} test cases from Braintrust`);

  return testCases;
};

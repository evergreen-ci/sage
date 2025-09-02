import { Factuality } from 'autoevals';
import { Eval, traced } from 'braintrust';
import fs from 'fs';
import path from 'path';
import { mastra } from 'mastra';

type WorkflowInput = {
  path: string;
};

type WorkflowOutput = {
  markdown: string;
  summary: string;
};

type TestExpected = {
  rootCause: string;
  evidenceString: string;
};

type TestMetadata = {
  fileName: string;
  difficulty: string;
  fileSize: string;
  taskName: string;
};

function getFileSizeInMB(filePath: string): string {
  try {
    const stats = fs.statSync(filePath);
    const mb = stats.size / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  } catch {
    return 'N/A';
  }
}

const evaluationResults: Array<{
  fileName: string;
  fileSize: string;
  difficulty: string;
  expectedRootCause: string;
  generatedSummary: string;
  rootCauseFound: boolean;
  factualityScore: number;
}> = [];

// Custom test case loader
function loadTestCases() {
  const csvPath = path.join(
    process.cwd(),
    'test_data/eval_suite_loganalyzer/test_cases_with_filenames.csv'
  );
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());

  const dataRows = lines.slice(1);
  const testCases = [];

  for (const row of dataRows) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());

    const fileName = cells[cells.length - 1] || '';
    const rootCause = cells[2] || '';
    const difficulty = cells[4] || '';
    const evidence = cells[5] || '';
    const taskName = cells[6] || '';

    if (fileName && fileName !== 'Matched File Name') {
      const logPath = path.join(
        process.cwd(),
        'test_data/eval_suite_loganalyzer',
        fileName
      );

      testCases.push({
        input: {
          path: logPath,
        },
        expected: {
          rootCause: rootCause.replace(/"/g, ''),
          evidenceString: evidence.replace(/"/g, '').substring(0, 100),
        },
        metadata: {
          fileName,
          difficulty: difficulty.replace(/[()0-9]/g, '').trim(),
          fileSize: getFileSizeInMB(logPath),
          taskName,
        },
      });
    }
  }

  return testCases;
}

async function callLogAnalyzer(input: WorkflowInput): Promise<WorkflowOutput> {
  return traced(async span => {
    span.setAttributes({ name: 'log-analyzer-suite' });

    const run = await mastra
      .getWorkflow('logCoreAnalyzerWorkflow')
      .createRunAsync();

    const result = await run.start({
      inputData: input,
    });

    const output = result.status === 'success' ? result.result : null;

    span.log({
      input,
      output,
      metadata: { status: result.status },
    });

    if (result.status !== 'success' || !output) {
      throw new Error(`Workflow failed: ${result.status}`);
    }

    return output as WorkflowOutput;
  });
}

// Custom scorer for exact match of the root cause, but AI based factuality is a better metric.
const rootCauseScorer = (args: {
  input: WorkflowInput;
  output: WorkflowOutput;
  expected: TestExpected;
  metadata?: TestMetadata;
}) => {
  const { expected, metadata, output } = args;

  const combinedOutput = `${output.markdown} ${output.summary}`.toLowerCase();
  const rootCauseLower = expected.rootCause.toLowerCase();

  const rootCauseFound =
    combinedOutput.includes(rootCauseLower) ||
    rootCauseLower
      .split(' ')
      .some(word => word.length > 4 && combinedOutput.includes(word));

  const score = rootCauseFound ? 1.0 : 0.0;

  return {
    name: 'Root Cause Detection',
    score,
    metadata: {
      rootCauseFound,
      fileName: metadata?.fileName,
      difficulty: metadata?.difficulty,
      fileSize: metadata?.fileSize,
    },
  };
};

async function logEvaluation(
  output: WorkflowOutput,
  expected: TestExpected,
  metadata?: TestMetadata
) {
  const combinedOutput = `${output.markdown} ${output.summary}`.toLowerCase();
  const rootCauseLower = expected.rootCause.toLowerCase();
  const rootCauseFound = combinedOutput.includes(rootCauseLower);

  const factualityResult = await Factuality.partial({})({
    input: metadata?.fileName || 'log file',
    output: output.summary,
    expected: `The root cause should be: ${expected.rootCause}`,
  });

  const factualityScore =
    typeof factualityResult.score === 'number'
      ? factualityResult.score * 100
      : 0;

  evaluationResults.push({
    fileName: metadata?.fileName || 'Unknown',
    fileSize: metadata?.fileSize || 'N/A',
    difficulty: metadata?.difficulty || 'Unknown',
    expectedRootCause: expected.rootCause,
    generatedSummary: output.summary.substring(0, 500),
    rootCauseFound,
    factualityScore,
  });

  console.log(`\nFile: ${metadata?.fileName || 'Unknown'}`);
  console.log(`Size: ${metadata?.fileSize || 'N/A'}`);
  console.log(`Difficulty: ${metadata?.difficulty || 'Unknown'}`);
  console.log(`Root Cause: ${expected.rootCause}`);
  console.log(`Summary: ${output.summary.substring(0, 400)}...`);
  console.log(`Factuality Score: ${factualityScore.toFixed(1)}%`);
  console.log('-'.repeat(80));
}

// Export to JSON and Markdown report for easy manual assessment
function exportResults() {
  if (evaluationResults.length === 0) {
    console.log('\nNo evaluation results to export');
    return;
  }

  const totalTests = evaluationResults.length;
  const passedTests = evaluationResults.filter(r => r.rootCauseFound).length;
  const avgFactuality = evaluationResults.reduce((sum, r) => sum + r.factualityScore, 0) / totalTests;

  const byDifficulty: Record<string, typeof evaluationResults> = {};
  evaluationResults.forEach(r => {
    if (!byDifficulty[r.difficulty]) byDifficulty[r.difficulty] = [];
    byDifficulty[r.difficulty]!.push(r);
  });

  const summary = {
    metadata: {
      timestamp: new Date().toISOString(),
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      passRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`,
      avgFactualityScore: `${avgFactuality.toFixed(1)}%`,
    },
    byDifficulty: Object.entries(byDifficulty).map(([difficulty, results]) => ({
      difficulty,
      count: results.length,
      passed: results.filter(r => r.rootCauseFound).length,
      passRate: `${((results.filter(r => r.rootCauseFound).length / results.length) * 100).toFixed(1)}%`,
      avgFactuality: `${(results.reduce((sum, r) => sum + r.factualityScore, 0) / results.length).toFixed(1)}%`,
    })),
    detailedResults: evaluationResults,
  };

  const jsonPath = path.join(process.cwd(), 'eval_results_log_analyzer.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  console.log(`\nDetailed results saved to: ${jsonPath}`);

  const mdReport = `# Log Analyzer Evaluation Results

## Summary
- Date: ${summary.metadata.timestamp}
- Total Tests: ${summary.metadata.totalTests}
- Passed: ${summary.metadata.passedTests}
- Failed: ${summary.metadata.failedTests}
- Pass Rate: ${summary.metadata.passRate}
- Avg Factuality Score: ${summary.metadata.avgFactualityScore}

## Results by Difficulty
${summary.byDifficulty.map(d => `
### ${d.difficulty || 'Unknown'}
- Tests: ${d.count}
- Passed: ${d.passed}
- Pass Rate: ${d.passRate}
- Avg Factuality: ${d.avgFactuality}
`).join('')}

## Failed Tests
${evaluationResults.filter(r => !r.rootCauseFound).map(r => `
- ${r.fileName} (${r.difficulty})
  - Expected: ${r.expectedRootCause}
  - Factuality: ${r.factualityScore.toFixed(1)}%
`).join('')}
`;

  const mdPath = path.join(process.cwd(), 'eval_results_log_analyzer.md');
  fs.writeFileSync(mdPath, mdReport);
  console.log(`Markdown report saved to: ${mdPath}`);

  console.log('\nEVALUATION SUMMARY');
  console.log('-'.repeat(80));
  console.log(`Total Tests: ${summary.metadata.totalTests}`);
  console.log(`Pass Rate: ${summary.metadata.passRate}`);
  console.log(`Average Factuality Score: ${summary.metadata.avgFactualityScore}`);
  console.log('-'.repeat(80));
}

const testCases = loadTestCases().slice(2);

console.log(`\nLoaded ${testCases.length} test cases from CSV\n`);

Eval<WorkflowInput, WorkflowOutput, TestExpected, TestMetadata>(
  'log-analyzer-suite',
  {
    data: testCases,
    task: async (input: WorkflowInput) => {
      const fileName = path.basename(input.path);
      console.log(`\nAnalyzing: ${fileName}`);

      const testCase = testCases.find(tc => tc.input.path === input.path);
      const result = await callLogAnalyzer(input);

      if (testCase) {
        await logEvaluation(result, testCase.expected, testCase.metadata);
      }

      if (evaluationResults.length === testCases.length) {
        setTimeout(() => {
          exportResults();
        }, 1000);
      }

      return result;
    },
    scores: [
      rootCauseScorer,
      async ({ expected, input, output }) =>
        await Factuality.partial({})({
          input: path.basename(input.path),
          output: output.summary,
          expected: `The root cause should be: ${expected.rootCause}`,
        }),
    ],
    experimentName: 'Log Analyzer Test Suite',
    description:
      'Simple test suite for log analyzer using real MongoDB test failure logs',
    maxConcurrency: 2,
  }
);
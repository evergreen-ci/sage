import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from 'evals/constants';
import { WorkflowOutput } from 'evals/types';
import { mastra } from 'mastra';
import { LOG_ANALYZER_WORKFLOW_NAME } from 'mastra/agents/constants';
import { getTestCases } from './testCases';
import { TestInput, TestResult } from './types';

const callLogAnalyzerWorkflow = async (
  input: TestInput
): Promise<WorkflowOutput<TestInput, TestResult>> => {
  const fileBlob = await input.file.data();
  const inputText = await fileBlob.text();

  const workflow = mastra.getWorkflowById(LOG_ANALYZER_WORKFLOW_NAME);
  const workflowRun = await workflow.createRunAsync({});
  const workflowRunResult = await workflowRun.start({
    inputData: {
      text: inputText,
      analysisContext: input.analysisContext,
    },
  });
  if (workflowRunResult.status !== 'success') {
    throw new Error('Workflow run failed');
  }
  const output = {
    markdown: workflowRunResult.result.markdown,
    summary: workflowRunResult.result.summary,
  };
  return {
    input,
    output,
  };
};

Eval(
  PROJECT_NAME,
  {
    data: getTestCases(),
    task: async (input: TestInput) => await callLogAnalyzerWorkflow(input),
    scores: [
      ({ expected, input, output }) =>
        Factuality.partial({})({
          expected: expected.summary,
          output: output.output.summary,
          input: input.analysisContext,
        }),
    ],
    experimentName: 'Log Analyzer Workflow Eval',
    description: 'Tests for the Log Analyzer Workflow.',
  },
  {
    reporter: ReporterName.LogAnalyzerWorkflow,
  }
);

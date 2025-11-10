import { createTool } from '@mastra/core';
import { createWorkflow } from '@mastra/core/workflows';
import {
  WorkflowInputSchema,
  WorkflowOutputSchema,
  WorkflowStateSchema,
} from './schemas';
import { loadDataStep, chunkStep } from './steps';
import { decideAndRunStep } from './workflows';

export const logCoreAnalyzerWorkflow = createWorkflow({
  id: 'log-core-analyzer',
  description:
    'Analyzes and summarizes log files, technical documents, or any text content. Produces a structured markdown report with key findings and a concise summary. ' +
    'INPUTS (provide exactly ONE): ' +
    '• path: Absolute file path on the local filesystem (e.g., "/var/log/app.log") ' +
    '• url: HTTP/HTTPS URL to fetch content from (e.g., "https://example.com/logs.txt") ' +
    '• text: Raw text content as a string (for content already in memory) ' +
    'OPTIONAL: analysisContext - Additional instructions for what to focus on (e.g., "Look for timeout errors", "Focus on authentication issues") ' +
    'NOTE: This tool analyzes raw file content. It does NOT fetch data from Evergreen or other APIs - provide the actual content or a direct URL/path to it.',
  inputSchema: WorkflowInputSchema,
  outputSchema: WorkflowOutputSchema,
  stateSchema: WorkflowStateSchema,
})
  .then(loadDataStep) // Use the new unified load step with validation
  .then(chunkStep)
  .then(decideAndRunStep)
  .commit();

export const logCoreAnalyzerTool: ReturnType<
  typeof createTool<
    typeof logCoreAnalyzerWorkflow.inputSchema,
    typeof logCoreAnalyzerWorkflow.outputSchema
  >
> = createTool({
  id: 'logCoreAnalyzerTool',
  description:
    logCoreAnalyzerWorkflow.description ||
    'Analyzes log files and text content',
  inputSchema: logCoreAnalyzerWorkflow.inputSchema,
  outputSchema: logCoreAnalyzerWorkflow.outputSchema,
  execute: async ({
    context,
    resourceId,
    runId,
    runtimeContext,
    tracingContext,
  }) => {
    const run = await logCoreAnalyzerWorkflow.createRunAsync({
      resourceId,
      runId,
    });

    const runResult = await run.start({
      inputData: context,
      runtimeContext,
      tracingContext,
    });
    if (runResult.status === 'success') {
      return runResult.result;
    }
    if (runResult.status === 'failed') {
      const errorMessage =
        runResult.error instanceof Error
          ? runResult.error.message
          : String(runResult.error);
      throw new Error(`Log analyzer workflow failed: ${errorMessage}`);
    }
    throw new Error(
      `Unexpected workflow execution status: ${runResult.status}. Expected 'success' or 'failed'.`
    );
  },
});

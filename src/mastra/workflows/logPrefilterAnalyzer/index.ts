import { createTool } from '@mastra/core/tools';
import { createWorkflow } from '@mastra/core/workflows';
import { loadDataStep } from '../logCoreAnalyzer/steps';
import {
  WorkflowInputSchema,
  WorkflowOutputSchema,
  PrefilterStateSchema,
} from './schemas';
import { errorScanStep, chunkFilteredStep } from './steps';
import { decideAndRunStep } from './workflows';

export const logPrefilterAnalyzerWorkflow = createWorkflow({
  id: 'log-prefilter-analyzer',
  description:
    'Analyzes log files by first scanning for error patterns with regex, then sending only error-relevant ' +
    'lines (with surrounding context) to the LLM for analysis. Produces the same structured markdown report ' +
    'as the core analyzer but with potentially faster processing and lower token usage on large logs. ' +
    'INPUTS (provide exactly ONE): ' +
    '• path: Absolute file path on the local filesystem (e.g., "/var/log/app.log") ' +
    '• url: HTTP/HTTPS URL to fetch content from (e.g., "https://example.com/logs.txt") ' +
    '• text: Raw text content as a string (for content already in memory) ' +
    'OPTIONAL: analysisContext - Additional instructions for what to focus on',
  inputSchema: WorkflowInputSchema,
  outputSchema: WorkflowOutputSchema,
  stateSchema: PrefilterStateSchema,
})
  .then(loadDataStep)
  .then(errorScanStep)
  .then(chunkFilteredStep)
  .then(decideAndRunStep)
  .commit();

export const logPrefilterAnalyzerTool: ReturnType<
  typeof createTool<
    'logPrefilterAnalyzerTool',
    typeof logPrefilterAnalyzerWorkflow.inputSchema,
    typeof logPrefilterAnalyzerWorkflow.outputSchema
  >
> = createTool({
  id: 'logPrefilterAnalyzerTool',
  description:
    logPrefilterAnalyzerWorkflow.description ||
    'Analyzes log files using regex pre-filtering before LLM analysis',
  inputSchema: logPrefilterAnalyzerWorkflow.inputSchema,
  outputSchema: logPrefilterAnalyzerWorkflow.outputSchema,
  execute: async (inputData, context) => {
    const run = await logPrefilterAnalyzerWorkflow.createRun({});

    const runResult = await run.start({
      inputData,
      ...context,
    });
    if (runResult.status === 'success') {
      return runResult.result;
    }
    if (runResult.status === 'failed') {
      const errorMessage =
        runResult.error instanceof Error
          ? runResult.error.message
          : String(runResult.error);
      throw new Error(
        `Pre-filter log analyzer workflow failed: ${errorMessage}`
      );
    }
    throw new Error(
      `Unexpected workflow execution status: ${runResult.status}. Expected 'success' or 'failed'.`
    );
  },
});

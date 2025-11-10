import { createTool } from '@mastra/core';
import { logCoreAnalyzerWorkflow } from '.';

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

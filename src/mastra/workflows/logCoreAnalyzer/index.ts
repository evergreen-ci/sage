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

// Re-export the tool
export { logCoreAnalyzerTool } from './tool';

import { createWorkflow } from '@mastra/core/workflows';
import {
  WorkflowInputSchema,
  WorkflowOutputSchema,
  WorkflowStateSchema,
} from './schemas';
import {
  formatPromptStep,
  generateStep,
  planSectionsStep,
  validateStep,
} from './steps';

export const releaseNotesWorkflow = createWorkflow({
  id: 'release-notes',
  description:
    'Generates structured release notes from Jira issues and pull request metadata. The workflow plans sections, formats the prompt, generates release notes with retry logic, and validates the output.',
  inputSchema: WorkflowInputSchema,
  outputSchema: WorkflowOutputSchema,
  stateSchema: WorkflowStateSchema,
  retryConfig: {
    attempts: 2,
    delay: 1000,
  },
})
  .then(planSectionsStep)
  .then(formatPromptStep)
  .then(generateStep)
  .then(validateStep)
  .commit();

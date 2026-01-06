export {
  CursorApiClient,
  CursorApiClientError,
  createCursorApiClient,
} from './cursorApiClient';

export {
  buildPromptFromTicketData,
  launchCursorAgent,
  normalizeRepositoryUrl,
} from './cursorAgentService';

// Re-export schemas
export {
  CursorAgentStatus,
  cursorAgentResponseSchema,
  cursorAgentSourceSchema,
  cursorAgentTargetSchema,
  cursorApiErrorSchema,
  cursorPromptImageSchema,
  cursorPromptSchema,
  cursorWebhookConfigSchema,
  launchAgentInputSchema,
  launchAgentRequestSchema,
  launchAgentResultSchema,
} from './schemas';

// Re-export types
export type {
  CursorAgentResponse,
  CursorAgentSource,
  CursorAgentTarget,
  CursorApiError,
  CursorPrompt,
  CursorPromptImage,
  CursorWebhookConfig,
  LaunchAgentInput,
  LaunchAgentRequest,
  LaunchAgentResult,
} from './types';

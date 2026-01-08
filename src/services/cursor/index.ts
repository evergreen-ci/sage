export {
  buildPromptFromTicketData,
  launchCursorAgent,
  normalizeRepositoryUrl,
} from './cursorAgentService';

// Re-export internal schemas
export { launchAgentInputSchema, launchAgentResultSchema } from './schemas';

// Re-export internal types
export type { LaunchAgentInput, LaunchAgentResult } from './types';

// Re-export generated Cursor API types
export type {
  CreateAgentRequest,
  CreateAgentResponse,
  Error as CursorApiError,
  GetAgentResponse,
  ListAgentsResponse,
} from './generated';

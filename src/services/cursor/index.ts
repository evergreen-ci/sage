export {
  CursorApiClient,
  CursorApiClientError,
  createCursorApiClient,
} from './cursorApiClient';

export {
  buildPromptFromTicketData,
  getAgentStatus,
  launchCursorAgent,
  normalizeRepositoryUrl,
} from './cursorAgentService';

// Re-export internal types
export type {
  CursorAgentStatus,
  GetAgentStatusInput,
  GetAgentStatusResult,
  LaunchAgentInput,
  LaunchAgentResult,
} from './types';

// Re-export generated Cursor API types
export type {
  CreateAgentRequest,
  CreateAgentResponse,
  Error as CursorApiError,
  GetAgentResponse,
  ListAgentsResponse,
} from '@/generated/cursor-api';

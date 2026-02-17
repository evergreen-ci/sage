export {
  CursorApiClient,
  CursorApiClientError,
  createCursorApiClient,
} from './cursorApiClient';

export {
  addFollowupToAgent,
  buildPromptFromTicketData,
  getAgentConversation,
  getAgentStatus,
  launchCursorAgent,
  launchResearcherAgent,
  normalizeRepositoryUrl,
  waitForAgentCompletion,
} from './cursorAgentService';

export type {
  AddFollowupInput,
  AddFollowupResult,
  AgentConversationInput,
  AgentConversationMessage,
  AgentConversationResult,
  AgentStatusInput,
  AgentStatusResult,
  CursorAgentStatus,
  LaunchAgentInput,
  LaunchAgentResult,
  LaunchResearcherInput,
} from './types';

export type {
  AddFollowupResponse,
  CreateAgentRequest,
  CreateAgentResponse,
  Error as CursorApiError,
  GetAgentConversationResponse,
  GetAgentResponse,
  ListAgentsResponse,
} from '@/generated/cursor-api';

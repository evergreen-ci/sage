/**
 * Input to launch a Cursor agent from ticket data
 * This is our internal type for passing ticket data to the launch function
 */
export interface LaunchAgentInput {
  ticketKey: string;
  summary: string;
  description: string | null;
  targetRepository: string;
  /** Optional branch/ref to use. If not provided, Cursor uses the repo's default branch */
  targetRef?: string;
  assigneeEmail: string;
  autoCreatePr?: boolean;
}

/**
 * Result of launching a Cursor agent
 * This is our internal type for the launch result
 */
export interface LaunchAgentResult {
  success: boolean;
  agentId?: string;
  agentUrl?: string;
  error?: string;
}

/**
 * Cursor agent status values from the API
 */
export type CursorAgentStatus =
  | 'RUNNING'
  | 'FINISHED'
  | 'ERROR'
  | 'CREATING'
  | 'EXPIRED';

export interface AgentStatusInput {
  agentId: string;
  assigneeEmail: string;
}

export interface AgentStatusResult {
  success: boolean;
  status?: CursorAgentStatus;
  prUrl?: string;
  summary?: string;
  agentUrl?: string;
  error?: string;
}

export interface LaunchResearcherInput {
  targetRepository: string;
  targetRef?: string;
  prompt: string;
  userEmail: string;
}

export interface AgentConversationInput {
  agentId: string;
  userEmail: string;
}

export interface AgentConversationMessage {
  id: string;
  type: 'user_message' | 'assistant_message';
  text: string;
}

export interface AgentConversationResult {
  success: boolean;
  messages?: AgentConversationMessage[];
  error?: string;
}

export interface AddFollowupInput {
  agentId: string;
  text: string;
  userEmail: string;
}

export interface AddFollowupResult {
  success: boolean;
  agentId?: string;
  error?: string;
}

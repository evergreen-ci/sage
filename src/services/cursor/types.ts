/**
 * Input to launch a Cursor agent from ticket data
 * This is our internal type for passing ticket data to the launch function
 */
export interface LaunchAgentInput {
  ticketKey: string;
  summary: string;
  description: string | null;
  targetRepository: string;
  /** Branch/ref to use - either from inline label or from config lookup */
  targetRef: string;
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

/**
 * Input to get the status of a Cursor agent
 */
export interface GetAgentStatusInput {
  /** The Cursor agent ID */
  agentId: string;
  /** Email of the user whose API key should be used */
  assigneeEmail: string;
}

/**
 * Result of getting a Cursor agent's status
 */
export interface GetAgentStatusResult {
  success: boolean;
  status?: CursorAgentStatus;
  prUrl?: string;
  summary?: string;
  agentUrl?: string;
  error?: string;
}

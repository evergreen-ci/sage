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

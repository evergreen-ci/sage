import { z } from 'zod';

/**
 * Zod schema for input to launch a Cursor agent from ticket data
 * This is our internal type for passing ticket data to the launch function
 */
export const launchAgentInputSchema = z.object({
  ticketKey: z.string(),
  summary: z.string(),
  description: z.string().nullable(),
  targetRepository: z.string(),
  /** Branch/ref to use - either from inline label or from config lookup */
  targetRef: z.string(),
  assigneeEmail: z.string(),
  autoCreatePr: z.boolean().optional().default(false),
});

/**
 * Zod schema for the result of launching a Cursor agent
 * This is our internal type for the launch result
 */
export const launchAgentResultSchema = z.object({
  success: z.boolean(),
  agentId: z.string().optional(),
  agentUrl: z.string().optional(),
  error: z.string().optional(),
});

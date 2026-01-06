import { z } from 'zod';

/**
 * Cursor Cloud Agent status enum values
 */
export enum CursorAgentStatus {
  Creating = 'CREATING',
  Running = 'RUNNING',
  Stopped = 'STOPPED',
  Finished = 'FINISHED',
  Failed = 'FAILED',
}

/**
 * Zod schema for Cursor agent source configuration
 */
export const cursorAgentSourceSchema = z.object({
  repository: z.string(),
  ref: z.string().optional(),
});

/**
 * Zod schema for Cursor agent target configuration
 */
export const cursorAgentTargetSchema = z.object({
  branchName: z.string().optional(),
  url: z.string().optional(),
  prUrl: z.string().optional(),
  autoCreatePr: z.boolean().optional(),
  openAsCursorGithubApp: z.boolean().optional(),
  skipReviewerRequest: z.boolean().optional(),
});

/**
 * Zod schema for Cursor Cloud Agent response
 */
export const cursorAgentResponseSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  status: z.nativeEnum(CursorAgentStatus),
  source: cursorAgentSourceSchema,
  target: cursorAgentTargetSchema.optional(),
  summary: z.string().optional(),
  createdAt: z.string(),
});

/**
 * Zod schema for image in prompt
 */
export const cursorPromptImageSchema = z.object({
  data: z.string(),
  dimension: z.object({
    width: z.number(),
    height: z.number(),
  }),
});

/**
 * Zod schema for prompt object
 */
export const cursorPromptSchema = z.object({
  text: z.string(),
  images: z.array(cursorPromptImageSchema).optional(),
});

/**
 * Zod schema for webhook configuration
 */
export const cursorWebhookConfigSchema = z.object({
  url: z.string(),
  secret: z.string().optional(),
});

/**
 * Zod schema for launch agent request
 */
export const launchAgentRequestSchema = z.object({
  prompt: cursorPromptSchema,
  model: z.string().optional(),
  source: cursorAgentSourceSchema,
  target: z
    .object({
      autoCreatePr: z.boolean().optional(),
      openAsCursorGithubApp: z.boolean().optional(),
      skipReviewerRequest: z.boolean().optional(),
      branchName: z.string().optional(),
    })
    .optional(),
  webhook: cursorWebhookConfigSchema.optional(),
});

/**
 * Zod schema for Cursor API error response
 */
export const cursorApiErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
});

/**
 * Zod schema for input to launch a Cursor agent from ticket data
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
 */
export const launchAgentResultSchema = z.object({
  success: z.boolean(),
  agentId: z.string().optional(),
  agentUrl: z.string().optional(),
  error: z.string().optional(),
});

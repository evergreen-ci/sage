import { z } from 'zod';
import {
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

// Re-export schemas for convenience
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

/**
 * TypeScript type for Cursor agent source configuration
 */
export type CursorAgentSource = z.infer<typeof cursorAgentSourceSchema>;

/**
 * TypeScript type for Cursor agent target configuration
 */
export type CursorAgentTarget = z.infer<typeof cursorAgentTargetSchema>;

/**
 * TypeScript type for Cursor Cloud Agent response
 */
export type CursorAgentResponse = z.infer<typeof cursorAgentResponseSchema>;

/**
 * TypeScript type for image in prompt
 */
export type CursorPromptImage = z.infer<typeof cursorPromptImageSchema>;

/**
 * TypeScript type for prompt object
 */
export type CursorPrompt = z.infer<typeof cursorPromptSchema>;

/**
 * TypeScript type for webhook configuration
 */
export type CursorWebhookConfig = z.infer<typeof cursorWebhookConfigSchema>;

/**
 * TypeScript type for launch agent request
 */
export type LaunchAgentRequest = z.infer<typeof launchAgentRequestSchema>;

/**
 * TypeScript type for Cursor API error response
 */
export type CursorApiError = z.infer<typeof cursorApiErrorSchema>;

/**
 * TypeScript type for input to launch a Cursor agent from ticket data
 */
export type LaunchAgentInput = z.infer<typeof launchAgentInputSchema>;

/**
 * TypeScript type for the result of launching a Cursor agent
 */
export type LaunchAgentResult = z.infer<typeof launchAgentResultSchema>;

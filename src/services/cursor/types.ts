import { z } from 'zod';
import { launchAgentInputSchema, launchAgentResultSchema } from './schemas';

// Re-export internal schemas
export { launchAgentInputSchema, launchAgentResultSchema } from './schemas';

/**
 * TypeScript type for input to launch a Cursor agent from ticket data
 */
export type LaunchAgentInput = z.infer<typeof launchAgentInputSchema>;

/**
 * TypeScript type for the result of launching a Cursor agent
 */
export type LaunchAgentResult = z.infer<typeof launchAgentResultSchema>;

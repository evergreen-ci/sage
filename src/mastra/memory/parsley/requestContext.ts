import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import { USER_ID } from '@/mastra/agents/constants';

export const ParsleyRequestContextSchema = z.object({
  [USER_ID]: z.string(),
  logMetadata: z
    .object({
      task_id: z.string().optional(),
      execution: z.number().optional(),
      log_type: z.string().optional(),
      origin: z.string().optional(),
      test_id: z.string().optional(),
    })
    .optional(),
  logURL: z.string().optional(),
});

/**
 * Creates a request context for the Parsley chat route.
 * This is just a wrapper around RequestContext with some typing to assist in development.
 * @returns A request context for the Parsley chat route.
 */
export const createParsleyRequestContext = () =>
  new RequestContext<z.infer<typeof ParsleyRequestContextSchema>>();

import { RequestContext } from '@mastra/core/request-context';
import { USER_ID } from '@/mastra/agents/constants';

type ParsleyRequestContext = {
  [USER_ID]?: string;
  logMetadata?: {
    task_id?: string;
    execution?: number;
    log_type?: string;
    origin?: string;
    test_id?: string;
  };
  logURL?: string;
};

/**
 * Creates a request context for the Parsley chat route.
 * This is just a wrapper around RequestContext with some typing to assist in development.
 * @returns A request context for the Parsley chat route.
 */
export const createParsleyRequestContext = () =>
  new RequestContext<ParsleyRequestContext>();

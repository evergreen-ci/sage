import { RuntimeContext } from '@mastra/core/runtime-context';
import { USER_ID } from '../../agents/constants';

type ParsleyRuntimeContext = {
  [USER_ID]?: string;
  logMetadata?: {
    task_id?: string;
    execution?: number;
    log_type?: string;
    origin?: string;
    test_id?: string;
    logURL?: string;
  };
};

/**
 * Creates a runtime context for the Parsley chat route.
 * This is just a wrapper around RuntimeContext with some typing to assist in development.
 * @returns A runtime context for the Parsley chat route.
 */
export const createParsleyRuntimeContext = () =>
  new RuntimeContext<ParsleyRuntimeContext>();

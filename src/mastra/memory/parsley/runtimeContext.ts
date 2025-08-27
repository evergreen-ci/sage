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
  };
};

/**
 * Creates a runtime context for the Parsley network.
 * @param logMetadata - The log metadata to include in the runtime context.
 * @param context -
 * @returns A runtime context for the Parsley network.
 */
export const createParsleyRuntimeContext = () =>
  new RuntimeContext<ParsleyRuntimeContext>();

import type { ToolStream } from '@mastra/core/tools';

export type ProgressData = {
  percentage: number;
  phase: string;
  /**
   * Injected by the tool's outputWriter bridge so the frontend can correlate
   * progress updates with the correct tool call during parallel execution.
   */
  toolCallId?: string;
};

/**
 * Writes a progress update through the stream using writer.custom() with a
 * `data-tool-progress` type. This bypasses ToolStream's envelope wrapping (which
 * would bury the payload inside `workflow-step-output` / `tool-output`
 * envelopes) and emits a DataChunkType that the AI SDK stream transformer
 * recognises and forwards to the frontend as-is.
 * @param writer - The ToolStream instance to write to, or undefined to no-op.
 * @param percentage - Progress percentage (clamped to 0-100, rounded).
 * @param phase - Human-readable label for the current phase.
 */
export const writeProgress = async (
  writer: ToolStream | undefined,
  percentage: number,
  phase: string
): Promise<void> => {
  if (!writer) return;
  await writer.custom({
    type: 'data-tool-progress' as const,
    data: {
      percentage: Math.min(100, Math.max(0, Math.round(percentage))),
      phase,
    } satisfies ProgressData,
  });
};

type DataOutputChunk = {
  type: `data-${string}`;
  data: Record<string, unknown>;
};
/**
 * Creates an outputWriter that bridges workflow chunks to the tool stream via
 * writer.custom(), bypassing ToolStream's envelope wrapping. Forwards any
 * `data-*` typed chunk as-is, injecting toolCallId so that frontend clients can
 * correlate chunks with the correct tool call during parallel execution.
 * This is useful for tools that write progress updates or other data to the stream
 * that isn't an output-chunk type like `tool-output` or `workflow-step-output`.
 * @param writer - The ToolStream instance to write to, or undefined to no-op.
 * @param toolCallId - The tool call ID to inject into each chunk's data.
 * @returns An outputWriter function, or undefined when no writer is available.
 * @example
 * Tool execute method example:
 * execute: async (inputData, context) => {
 *   const run = await myWorkflow.createRun({});
 *   const outputWriter = createToolOutputWriter(
 *     context?.writer,
 *     context?.agent?.toolCallId
 *   );
 *   return run.start({ inputData, ...context, outputWriter });
 * }
 */
export const createToolOutputWriter = (
  writer: ToolStream | undefined,
  toolCallId: string | undefined
): ((chunk: unknown) => Promise<void>) | undefined => {
  if (!writer) return undefined;
  return async (chunk: unknown) => {
    const record = chunk as DataOutputChunk;
    const data =
      toolCallId && record.data ? { ...record.data, toolCallId } : record.data;
    await writer.custom({ ...record, data } as DataOutputChunk);
  };
};

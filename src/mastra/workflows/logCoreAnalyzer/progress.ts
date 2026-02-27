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
 * `data-progress` type. This bypasses ToolStream's envelope wrapping (which
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
    type: 'data-progress' as const,
    data: {
      percentage: Math.min(100, Math.max(0, Math.round(percentage))),
      phase,
    } satisfies ProgressData,
  });
};

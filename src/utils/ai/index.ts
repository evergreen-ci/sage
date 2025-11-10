import { createUIMessageStream, InferUIMessageChunk, UIMessage } from 'ai';

/**
 * Creates a UIMessageStream with metadata for the given stream.
 * This is a helpful utility function to add metadata to a stream that is already in AISDK format.
 * @param stream - The stream to create a UIMessageStream from.
 * @param metadata - The metadata to add to the UIMessageStream.
 * @returns A UIMessageStream with the given metadata.
 */
export const createAISdkStreamWithMetadata = (
  stream: ReadableStream<InferUIMessageChunk<UIMessage>>,
  metadata: Record<string, unknown>
) =>
  createUIMessageStream({
    execute: async ({ writer }) => {
      for await (const part of stream!) {
        writer.write(part);
      }
      writer.write({
        type: 'message-metadata',
        messageMetadata: metadata,
      });
    },
  });

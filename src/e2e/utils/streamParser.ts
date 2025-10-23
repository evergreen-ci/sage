interface StreamMessage {
  type: string;
  spanId?: string;
  messageMetadata?: {
    spanId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Parses Server-Sent Events (SSE) stream data
 * @param chunk - Raw chunk string from the stream
 * @returns Array of parsed messages
 */
export function parseStreamData(chunk: string): StreamMessage[] {
  const lines = chunk.split('\n');
  const messages: StreamMessage[] = [];

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        messages.push({ type: 'done' });
      } else {
        try {
          const parsed = JSON.parse(data);
          messages.push(parsed);
        } catch (e) {
          // Ignore parse errors for malformed JSON
        }
      }
    }
  }

  return messages;
}

/**
 * Extracts the spanId from a streaming response
 * @param responseText - The full response text from the stream
 * @param debug - Enable debug logging to see all message types
 * @returns The spanId if found, undefined otherwise
 */
export function extractSpanIdFromStream(
  responseText: string,
  debug = false
): string | undefined {
  const messages = parseStreamData(responseText);

  if (debug) {
    console.log('Total messages parsed:', messages.length);
    console.log(
      'Message types:',
      messages.map(m => m.type)
    );
  }

  for (const msg of messages) {
    if (debug && msg.type === 'message-metadata') {
      console.log('Found message-metadata:', JSON.stringify(msg, null, 2));
    }

    // Check for spanId in message-metadata events (nested in messageMetadata)
    if (msg.type === 'message-metadata' && msg.messageMetadata?.spanId) {
      if (debug) {
        console.log('Extracting spanId:', msg.messageMetadata.spanId);
      }
      return msg.messageMetadata.spanId;
    }

    // Also check for spanId at root level (fallback)
    if (msg.spanId) {
      if (debug) {
        console.log(
          `Found spanId in ${msg.type} event:`,
          JSON.stringify(msg, null, 2)
        );
      }
      return msg.spanId;
    }
  }

  if (debug) {
    console.log('No spanId found in any message');
  }

  return undefined;
}

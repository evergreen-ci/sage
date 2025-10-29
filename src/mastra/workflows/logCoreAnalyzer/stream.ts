const LINE_FLUSH_LIMIT = 10_000; // 10K lines
const BYTE_FLUSH_LIMIT = 20 * 1024 * 1024; // 20MB

/**
 * `streamLines` is an async generator that yields Uint8Array chunks representing lines from the input.
 * @param input - ReadableStream, Buffer, or string input
 * @yields {Uint8Array} chunks
 * @throws {Error} for unsupported input types
 * @returns AsyncGenerator<Uint8Array> that can be used to read the input in chunks
 */
export const streamLines = async function* (
  input: ReadableStream | Buffer | string
): AsyncGenerator<Uint8Array> {
  if (typeof input === 'string') {
    yield new TextEncoder().encode(input);
  } else if (Buffer.isBuffer(input)) {
    yield input;
  } else if (input instanceof ReadableStream) {
    const reader = input.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read(); // eslint-disable-line no-await-in-loop
        if (done) break;
        yield value;
      }
    } finally {
      // When we stop reading, we should cleanup the reader to free up resources.
      reader.releaseLock();
    }
  } else {
    throw new Error('unsupported input type');
  }
};

/**
 * `appendLineNumbers` reads from the input stream and appends line numbers to each line.
 * @param input - ReadableStream, Buffer, or string input
 * @param options - optional arguments to the function
 * @param options.byteFlushLimit - Number of bytes to accumulate before flushing
 * @param options.lineFlushLimit - Number of lines to accumulate before flushing
 * @param options.maxSizeBytes - Maximum size in bytes to process before truncating
 * @returns Promise resolving to an object containing the processed text, a truncated boolean flag, and the total byte size
 */
export const appendLineNumbers = async (
  input: ReadableStream | Buffer | string,
  options?: {
    byteFlushLimit?: number;
    lineFlushLimit?: number;
    maxSizeBytes?: number;
  }
): Promise<{ text: string; truncated: boolean; totalSize: number }> => {
  const decoder = new TextDecoder();

  const byteFlushLimit = options?.byteFlushLimit ?? BYTE_FLUSH_LIMIT;
  const lineFlushLimit = options?.lineFlushLimit ?? LINE_FLUSH_LIMIT;
  const maxSizeBytes = options?.maxSizeBytes ?? Infinity;

  let leftover = '';
  let lineNumber = 0;
  let byteCount = 0;
  let lineBuffer: string[] = [];

  let totalSize = 0;
  let truncated = false;

  const chunks: string[] = [];

  for await (const bytes of streamLines(input)) {
    totalSize += bytes.length;

    // If we have exceeded the maximum allowed size, we stop processing and exit early.
    if (totalSize > maxSizeBytes) {
      truncated = true;
      break;
    }

    const chunk = decoder.decode(bytes, { stream: true });
    const combined = leftover + chunk;
    const parts = combined.split(/\r?\n/);

    // leftover contains any text after the last newline character in the current chunk.
    // A chunk may end in the middle of a line, so we save that part to prepend it to the next chunk.
    leftover = parts.pop() || '';

    for (const line of parts) {
      const numberedLine = `[L: ${lineNumber.toString().padStart(6, ' ')}] ${line}`;
      lineBuffer.push(numberedLine);
      lineNumber += 1;

      // We are approximating 1 char as 1 byte.
      byteCount += numberedLine.length;

      // Instead of appending line-by-line, it is more efficient to append in batches.
      // Each append operation will copy the entire string which is costly, so we want to do it as
      // infrequently as possible.
      if (lineBuffer.length >= lineFlushLimit || byteCount >= byteFlushLimit) {
        chunks.push(lineBuffer.join('\n'));
        lineBuffer = [];
        byteCount = 0;
      }
    }
  }

  // leftover should always contain a single line at the end. It is not possible for it to contain
  // multiple lines because we always split on newline characters and only keep the last fragment.
  if (leftover.length > 0) {
    const numberedLine = `[L: ${lineNumber.toString().padStart(6, ' ')}] ${leftover}`;
    lineBuffer.push(numberedLine);
  }

  // If there are any remaining lines in the buffer, append them as well.
  if (lineBuffer.length > 0) {
    chunks.push(lineBuffer.join('\n'));
  }

  return { text: chunks.join('\n'), truncated, totalSize };
};

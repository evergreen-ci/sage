import { streamLines, appendLineNumbers } from './stream';

// Helper function to create a ReadableStream for testing - taken from Parsley
const createReadableStream = (chunks: string[]) => {
  const encoder = new TextEncoder();
  const encodedChunks = chunks.map(chunk => encoder.encode(chunk));
  const readableStream = new ReadableStream({
    start(controller) {
      encodedChunks.forEach(chunk => controller.enqueue(chunk));
      controller.close();
    },
  });
  return readableStream;
};

describe('streamLines', () => {
  describe('string input', () => {
    it('should yield string as Uint8Array', async () => {
      const input = 'hello world';
      const generator = streamLines(input);
      const result = await generator.next();

      expect(result.done).toBe(false);
      expect(result.value).toBeInstanceOf(Uint8Array);

      const textDecoder = new TextDecoder();
      expect(textDecoder.decode(result.value)).toBe('hello world');

      const next = await generator.next();
      expect(next.done).toBe(true);
    });

    it('should handle empty string', async () => {
      const input = '';
      const generator = streamLines(input);
      const result = await generator.next();

      expect(result.done).toBe(false);
      expect(result.value).toBeInstanceOf(Uint8Array);
      expect(result.value.length).toBe(0);
    });
  });

  describe('Buffer input', () => {
    it('should yield Buffer as Uint8Array', async () => {
      const input = Buffer.from('hello buffer');
      const generator = streamLines(input);
      const result = await generator.next();

      expect(result.done).toBe(false);
      expect(result.value).toBeInstanceOf(Uint8Array);

      const textDecoder = new TextDecoder();
      expect(textDecoder.decode(result.value)).toBe('hello buffer');

      const next = await generator.next();
      expect(next.done).toBe(true);
    });

    it('should handle empty Buffer', async () => {
      const input = Buffer.alloc(0);
      const generator = streamLines(input);
      const result = await generator.next();

      expect(result.done).toBe(false);
      expect(result.value.length).toBe(0);
    });
  });

  describe('ReadableStream input', () => {
    it('should stream ReadableStream chunks', async () => {
      const chunks = ['hello ', 'world', '!'];
      const response = createReadableStream(chunks);

      const generator = streamLines(response);
      const results: string[] = [];

      const textDecoder = new TextDecoder();
      for await (const chunk of generator) {
        results.push(textDecoder.decode(chunk));
      }
      expect(results).toEqual(['hello ', 'world', '!']);
    });

    it('should handle empty ReadableStream', async () => {
      const response = createReadableStream([]);

      const generator = streamLines(response);
      const results: Uint8Array[] = [];

      for await (const chunk of generator) {
        results.push(chunk);
      }
      expect(results).toEqual([]);
    });

    it('should handle single chunk ReadableStream', async () => {
      const response = createReadableStream(['single chunk']);

      const generator = streamLines(response);
      const result = await generator.next();

      expect(result.done).toBe(false);
      const textDecoder = new TextDecoder();
      expect(textDecoder.decode(result.value)).toBe('single chunk');

      const next = await generator.next();
      expect(next.done).toBe(true);
    });
  });
});

describe('appendLineNumbers', () => {
  describe('string input', () => {
    it('should add line numbers to simple text', async () => {
      const input = 'line1\nline2\nline3';
      const result = await appendLineNumbers(input);
      expect(result.text).toBe(
        '[L:      0] line1\n[L:      1] line2\n[L:      2] line3'
      );
    });

    it('should handle single line without newline', async () => {
      const input = 'single line';
      const result = await appendLineNumbers(input);
      expect(result.text).toBe('[L:      0] single line');
    });

    it('should maintain exact content including tabs, whitespace, and trailing spaces', async () => {
      const input = 'line1   \nline2\t\n   line3   ';
      const result = await appendLineNumbers(input);
      expect(result.text).toBe(
        '[L:      0] line1   \n[L:      1] line2\t\n[L:      2]    line3   '
      );
    });
  });

  describe('Buffer input', () => {
    it('should handle Buffer with simple text', async () => {
      const input = Buffer.from('line1\nline2\nline3');
      const result = await appendLineNumbers(input);
      expect(result.text).toBe(
        '[L:      0] line1\n[L:      1] line2\n[L:      2] line3'
      );
    });
  });

  describe('ReadableStream input', () => {
    it('should handle simple stream with complete lines', async () => {
      const stream = createReadableStream(['line1\n', 'line2\n', 'line3']);
      const result = await appendLineNumbers(stream);
      expect(result.text).toBe(
        '[L:      0] line1\n[L:      1] line2\n[L:      2] line3'
      );
    });

    it('should handle stream with line breaks across chunks', async () => {
      const stream = createReadableStream(['line1\nli', 'ne2\nline3']);
      const result = await appendLineNumbers(stream);
      expect(result.text).toBe(
        '[L:      0] line1\n[L:      1] line2\n[L:      2] line3'
      );
    });

    it('should handle single character chunks', async () => {
      const stream = createReadableStream([
        'l',
        'i',
        'n',
        'e',
        '1',
        '\n',
        'l',
        'i',
        'n',
        'e',
        '2',
      ]);
      const result = await appendLineNumbers(stream);
      expect(result.text).toBe('[L:      0] line1\n[L:      1] line2');
    });
  });

  describe('all inputs', () => {
    it('should produce identical results for same content across all input types', async () => {
      const content = 'line1\nline2\nline3\n';

      const stringResult = await appendLineNumbers(content);
      const bufferResult = await appendLineNumbers(Buffer.from(content));
      const streamResult = await appendLineNumbers(
        createReadableStream([content])
      );

      expect(stringResult.text).toBe(bufferResult.text);
      expect(bufferResult.text).toBe(streamResult.text);
    });
  });

  describe('flushing', () => {
    it('should handle input that triggers line flush limit', async () => {
      const lines = Array.from({ length: 1050 }, (_, i) => `line ${i}`);
      const input = lines.join('\n');
      const result = await appendLineNumbers(input, {
        lineFlushLimit: 1000, // Flush every 1000 lines
      });

      const resultLines = result.text.split('\n');
      expect(resultLines).toHaveLength(1050);
      expect(resultLines[0]).toBe('[L:      0] line 0');
      expect(resultLines[1049]).toBe('[L:   1049] line 1049');
    });

    it('should handle input that triggers byte flush limit', async () => {
      const longLine = 'x'.repeat(1000000); // 1MB per line
      const lines = Array.from({ length: 5 }, () => longLine); // 5MB total
      const input = lines.join('\n');
      const result = await appendLineNumbers(input, {
        byteFlushLimit: 1000000, // 1MB limit
      });
      const resultLines = result.text.split('\n');
      expect(resultLines).toHaveLength(5);
    });
  });
});

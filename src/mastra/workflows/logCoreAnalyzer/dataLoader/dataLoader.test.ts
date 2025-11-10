import { simulateReadableStream } from 'ai';
import { logAnalyzerConfig } from '../config';
import { SourceType } from '../constants';
import { loadFromFile, loadFromUrl, loadFromText } from '.';

const fsMock = vi.hoisted(() => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({ default: fsMock, ...fsMock }));

vi.mock('gpt-tokenizer', () => ({
  encode: vi.fn((text: string) => new Array(Math.ceil(text.length * 0.25))),
}));

const createFileSizeMock = (sizeInBytes: number) =>
  ({ size: sizeInBytes }) as unknown as import('fs').Stats;

// Constants for test scenarios
const TEST_CONSTANTS = {
  OVERSIZE_MULTIPLIER: 1.1,
  TOKEN_MULTIPLIER: 5,
  TEST_URLS: {
    INVALID: 'https://example.com/non-evergreen.log',
    VALID: 'http://localhost:9090/valid.log',
    MISSING: 'http://localhost:9090/missing.log',
    TIMEOUT: 'https://example.com/timeout.log',
  },
  ERROR_MESSAGES: {
    SIZE_LIMIT: 'Content size constraint exceeded',
    TOKEN_LIMIT: 'Token limit constraint violated',
    URL_INVALID: 'Invalid URL: Must start with the Evergreen API endpoint',
    FETCH_FAILURE: 'URL fetch operation failed',
  },
};

describe('dataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadFromFile', () => {
    it('should reject files over size limit', async () => {
      const fs = (await import('fs/promises')).default;
      const oversizeBytes = Math.floor(
        logAnalyzerConfig.limits.maxSizeMB *
          TEST_CONSTANTS.OVERSIZE_MULTIPLIER *
          1024 *
          1024
      );

      vi.mocked(fs.stat).mockResolvedValue(createFileSizeMock(oversizeBytes));

      await expect(loadFromFile('large.log')).rejects.toThrow(
        /Content size constraint exceeded/
      );
    });

    it('should reject invalid or null file paths', async () => {
      await expect(loadFromFile('')).rejects.toThrow();
      await expect(loadFromFile(null as unknown as string)).rejects.toThrow();
    });

    it('should load valid files within size and token limits', async () => {
      const fs = (await import('fs/promises')).default;
      const validSizeBytes = Math.floor(
        logAnalyzerConfig.limits.maxSizeMB * 0.5 * 1024 * 1024
      );

      vi.mocked(fs.stat).mockResolvedValue(createFileSizeMock(validSizeBytes));
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('log content'));

      const result = await loadFromFile('valid.log');
      expect(result.text).toBe('[L:      0] log content');
      expect(result.metadata.source).toBe(SourceType.File);
      expect(result.metadata.originalSize).toBe(validSizeBytes);
    });

    it('should reject files with too many tokens', async () => {
      const fs = (await import('fs/promises')).default;
      const fileSizeBytes = Math.floor(
        logAnalyzerConfig.limits.maxSizeMB * 0.9 * 1024 * 1024
      );
      const textLength =
        logAnalyzerConfig.limits.maxChars * TEST_CONSTANTS.TOKEN_MULTIPLIER;
      const hugeText = 'x'.repeat(textLength);

      vi.mocked(fs.stat).mockResolvedValue(createFileSizeMock(fileSizeBytes));
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(hugeText));

      try {
        await loadFromFile('huge-tokens.log');
        // Backstop for the test
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toMatch(
          /Token limit constraint violated/
        );
      }
    });
  });

  describe('loadFromUrl', () => {
    it('should truncate downloaded content over size limit', async () => {
      const oversizeBytes = Math.floor(
        logAnalyzerConfig.limits.maxSizeMB *
          TEST_CONSTANTS.OVERSIZE_MULTIPLIER *
          1024 *
          1024
      );
      const oversizeContent = 'x'.repeat(oversizeBytes);
      const CHUNK_SIZE = 4096 * 1000; // 4MB
      const oversizeContentChunks = [];
      for (let i = 0; i < oversizeContent.length; i += CHUNK_SIZE) {
        oversizeContentChunks.push(
          Buffer.from(oversizeContent.slice(i, i + CHUNK_SIZE))
        );
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: simulateReadableStream({
          chunks: oversizeContentChunks,
        }),
      });

      const result = await loadFromUrl(TEST_CONSTANTS.TEST_URLS.VALID);
      expect(result.metadata.truncated).toBe(true);
      // Size can be slightly over due to chunk boundaries
      expect(result.metadata.originalSize).toBeGreaterThan(
        logAnalyzerConfig.limits.maxSizeMB * 1024 * 1024
      );
      expect(result.text.length).toBeLessThanOrEqual(oversizeBytes);
    });

    it('should load valid URLs', async () => {
      const content = 'log content from URL';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-length': String(content.length),
        }),
        body: simulateReadableStream({ chunks: [Buffer.from(content)] }),
      });

      const result = await loadFromUrl(TEST_CONSTANTS.TEST_URLS.VALID);
      expect(result.text).toBe(`[L:      0] ${content}`);
      expect(result.metadata.source).toBe(SourceType.URL);
      expect(result.metadata.truncated).toBe(false);
    });

    it('should handle fetch failures with detailed error message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        loadFromUrl(TEST_CONSTANTS.TEST_URLS.MISSING)
      ).rejects.toThrow(/URL fetch operation failed: 404 Not Found/);
    });

    it('should handle network timeout', async () => {
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AbortError')), 100);
          })
      );

      await expect(
        loadFromUrl(TEST_CONSTANTS.TEST_URLS.TIMEOUT)
      ).rejects.toThrow();
    });
  });

  describe('loadFromText', () => {
    it('should reject extremely long text', async () => {
      const hugeText = 'x'.repeat(
        logAnalyzerConfig.limits.maxTextLength + 1000
      );

      try {
        await loadFromText(hugeText);
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toMatch(
          /Content size constraint exceeded/
        );
      }
    });

    it('should accept large text within limits', async () => {
      // Test with text that's large but within both size and token limits
      const charCount = Math.floor(
        logAnalyzerConfig.limits.maxTextLength * 0.9
      );
      const text = 'x'.repeat(charCount);

      const result = await loadFromText(text);
      expect(result.text).toBe(`[L:      0] ${text}`);
      expect(result.metadata.source).toBe(SourceType.Text);
      expect(result.metadata.originalSize).toBe(charCount);
    });

    it('should reject empty or null text', async () => {
      try {
        await loadFromText('');
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toMatch(/Text cannot be empty/);
      }

      try {
        await loadFromText(null as unknown as string);
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toMatch(
          /Text cannot be null or undefined/
        );
      }
    });

    it('should accept valid text', async () => {
      const text = 'Valid log content';

      const result = await loadFromText(text);
      expect(result.text).toBe(`[L:      0] ${text}`);
      expect(result.metadata.source).toBe(SourceType.Text);
      expect(result.metadata.originalSize).toBe(text.length);
    });
  });
});

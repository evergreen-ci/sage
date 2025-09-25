import { logAnalyzerConfig } from './config';
import { SOURCE_TYPE } from './constants';
import { loadFromFile, loadFromUrl, loadFromText } from './dataLoader';

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
    SIZE_LIMIT: 'exceeds limit',
    TOKEN_LIMIT: 'tokens, exceeds limit',
    URL_INVALID: 'Invalid URL needs to start with the Evergreen API endpoint',
    FETCH_FAILURE: 'Failed to fetch URL',
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
        logAnalyzerConfig.limits.maxFileSizeMB *
          TEST_CONSTANTS.OVERSIZE_MULTIPLIER *
          1024 *
          1024
      );

      vi.mocked(fs.stat).mockResolvedValue(createFileSizeMock(oversizeBytes));

      await expect(loadFromFile('large.log')).rejects.toThrow(
        TEST_CONSTANTS.ERROR_MESSAGES.SIZE_LIMIT
      );
    });

    it('should reject invalid or null file paths', async () => {
      await expect(loadFromFile('')).rejects.toThrow();
      await expect(loadFromFile(null as unknown as string)).rejects.toThrow();
    });

    it('should load valid files within size and token limits', async () => {
      const fs = (await import('fs/promises')).default;
      const validSizeBytes = Math.floor(
        logAnalyzerConfig.limits.maxFileSizeMB * 0.5 * 1024 * 1024
      );

      vi.mocked(fs.stat).mockResolvedValue(createFileSizeMock(validSizeBytes));
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('log content'));

      const result = await loadFromFile('valid.log');
      expect(result.text).toBe('log content');
      expect(result.metadata.source).toBe(SOURCE_TYPE.FILE);
      expect(result.metadata.originalSize).toBe(validSizeBytes);
    });

    it('should reject files with too many tokens', async () => {
      const fs = (await import('fs/promises')).default;
      const fileSizeBytes = Math.floor(
        logAnalyzerConfig.limits.maxFileSizeMB * 0.9 * 1024 * 1024
      );
      const textLength =
        logAnalyzerConfig.limits.maxChars * TEST_CONSTANTS.TOKEN_MULTIPLIER;
      const hugeText = 'x'.repeat(textLength);

      vi.mocked(fs.stat).mockResolvedValue(createFileSizeMock(fileSizeBytes));
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(hugeText));

      await expect(loadFromFile('huge-tokens.log')).rejects.toThrow(
        TEST_CONSTANTS.ERROR_MESSAGES.TOKEN_LIMIT
      );
    });
  });

  describe('loadFromUrl', () => {
    it('should reject non-evergreen URLs', async () => {
      await expect(
        loadFromUrl(TEST_CONSTANTS.TEST_URLS.INVALID)
      ).rejects.toThrow(TEST_CONSTANTS.ERROR_MESSAGES.URL_INVALID);
    });

    it('should reject URLs over size limit', async () => {
      const oversizeBytes = Math.floor(
        logAnalyzerConfig.limits.maxUrlSizeMB *
          TEST_CONSTANTS.OVERSIZE_MULTIPLIER *
          1024 *
          1024
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-length': String(oversizeBytes),
        }),
        text: async () => 'x'.repeat(oversizeBytes),
      });

      await expect(loadFromUrl(TEST_CONSTANTS.TEST_URLS.VALID)).rejects.toThrow(
        TEST_CONSTANTS.ERROR_MESSAGES.SIZE_LIMIT
      );
    });

    it('should load valid URLs', async () => {
      const content = 'log content from URL';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-length': String(content.length),
        }),
        text: async () => content,
      });

      const result = await loadFromUrl(TEST_CONSTANTS.TEST_URLS.VALID);
      expect(result.text).toBe(content);
      expect(result.metadata.source).toBe(SOURCE_TYPE.URL);
    });

    it('should handle fetch failures with detailed error message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        loadFromUrl(TEST_CONSTANTS.TEST_URLS.MISSING)
      ).rejects.toThrow(
        `${TEST_CONSTANTS.ERROR_MESSAGES.FETCH_FAILURE}: 404 Not Found`
      );
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

      await expect(loadFromText(hugeText)).rejects.toThrow(
        TEST_CONSTANTS.ERROR_MESSAGES.SIZE_LIMIT
      );
    });

    it('should reject text over token limit', async () => {
      const charCount = Math.min(
        logAnalyzerConfig.limits.maxTextLength - 1000,
        logAnalyzerConfig.limits.maxChars * TEST_CONSTANTS.TOKEN_MULTIPLIER
      );
      const text = 'x'.repeat(charCount);

      await expect(loadFromText(text)).rejects.toThrow(
        TEST_CONSTANTS.ERROR_MESSAGES.TOKEN_LIMIT
      );
    });

    it('should reject empty or null text', async () => {
      await expect(loadFromText('')).rejects.toThrow('Text cannot be empty');
      await expect(loadFromText(null as any)).rejects.toThrow(
        'Text cannot be null or undefined'
      );
    });

    it('should accept valid text', async () => {
      const text = 'Valid log content';

      const result = await loadFromText(text);
      expect(result.text).toBe(text);
      expect(result.metadata.source).toBe(SOURCE_TYPE.TEXT);
      expect(result.metadata.originalSize).toBe(text.length);
    });
  });
});

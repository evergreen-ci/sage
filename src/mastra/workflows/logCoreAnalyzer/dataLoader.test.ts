import { SOURCE_TYPE } from './constants';
import { loadFromFile, loadFromUrl, loadFromText } from './dataLoader';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    stat: vi.fn(),
    readFile: vi.fn(),
  },
}));

// Mock global fetch
global.fetch = vi.fn();

// Mock gpt-tokenizer
vi.mock('gpt-tokenizer', () => ({
  encode: vi.fn(
    (text: string) =>
      // Simple mock: ~0.25 tokens per character
      new Array(Math.ceil(text.length * 0.25))
  ),
}));

describe('dataLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadFromFile', () => {
    it('should reject files over size limit', async () => {
      const fs = (await import('fs/promises')).default;

      // Mock a 200MB file (exceeds 100MB limit)
      vi.mocked(fs.stat).mockResolvedValue({
        size: 200 * 1024 * 1024,
      } as any);

      await expect(loadFromFile('large.log')).rejects.toThrow('exceeds limit');
    });

    it('should load valid files', async () => {
      const fs = (await import('fs/promises')).default;

      // Mock a 1MB file
      vi.mocked(fs.stat).mockResolvedValue({
        size: 1024 * 1024,
      } as any);

      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('log content'));

      const result = await loadFromFile('valid.log');
      expect(result.text).toBe('log content');
      expect(result.metadata.source).toBe(SOURCE_TYPE.FILE);
      expect(result.metadata.originalSize).toBe(1024 * 1024);
    });

    it('should reject files with too many tokens', async () => {
      const fs = (await import('fs/promises')).default;

      // Mock a file that's under size limit but over token limit
      const hugeText = 'x'.repeat(60_000_000); // ~15M tokens

      vi.mocked(fs.stat).mockResolvedValue({
        size: hugeText.length,
      } as any);

      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(hugeText));

      await expect(loadFromFile('huge-tokens.log')).rejects.toThrow(
        'tokens, exceeds limit'
      );
    });
  });

  describe('loadFromUrl', () => {
    it('should reject URLs over size limit', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-length': String(200 * 1024 * 1024), // 200MB
        }),
        text: async () => 'x'.repeat(200 * 1024 * 1024),
      });

      await expect(
        loadFromUrl('https://example.com/large.log')
      ).rejects.toThrow('exceeds limit');
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

      const result = await loadFromUrl('https://example.com/valid.log');
      expect(result.text).toBe(content);
      expect(result.metadata.source).toBe(SOURCE_TYPE.URL);
    });

    it('should handle fetch failures', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        loadFromUrl('https://example.com/missing.log')
      ).rejects.toThrow('Failed to fetch URL: 404 Not Found');
    });

    it('should handle timeout', async () => {
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AbortError')), 100);
          })
      );

      await expect(
        loadFromUrl('https://example.com/timeout.log')
      ).rejects.toThrow();
    });
  });

  describe('loadFromText', () => {
    it('should reject text over character limit', async () => {
      const hugeText = 'x'.repeat(100_000_000); // 100M characters

      await expect(loadFromText(hugeText)).rejects.toThrow('exceeds limit');
    });

    it('should reject text over token limit', async () => {
      // Text that's under character limit but over token limit
      const text = 'x'.repeat(60_000_000); // ~15M tokens
      await expect(loadFromText(text)).rejects.toThrow('tokens, exceeds limit');
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

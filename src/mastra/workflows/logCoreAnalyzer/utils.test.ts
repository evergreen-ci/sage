import { normalizeLineEndings, cropMiddle } from './utils';

describe('normalizeLineEndings', () => {
  it('should normalize line endings', async () => {
    const input = 'line1\r\nline2\r\n\r\n\r\n\r\nline3';
    const expected = 'line1\nline2\n\n\nline3';

    expect(normalizeLineEndings(input)).toBe(expected);
  });
});

describe('cropMiddle', () => {
  it('should return text as-is if it fits', () => {
    const text = 'This is a short log entry';
    const result = cropMiddle(text, 100, 0.5, '...');
    expect(result).toBe(text);
  });

  it('should crop log file keeping beginning and end', () => {
    const text =
      `[2025-01-02 10:00:00] Starting server initialization...\n` +
      `Loading configuration files...\n${'x'.repeat(1000)}\n` +
      `[2025-01-02 10:05:00] Server started successfully on port 3000`;

    const result = cropMiddle(text, 150, 0.7, '...[truncated]...');

    expect(result).toContain('Starting server initialization');
    expect(result).toContain('port 3000');
    expect(result).toContain('[truncated]');
    expect(result.length).toBeLessThanOrEqual(150);
  });

  it('should handle exact hardcoded case', () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const result = cropMiddle(text, 13, 0.5, '...');

    // maxLength=13, separator='...' (3 chars), available=10
    // head=5 chars, tail=5 chars
    expect(result).toBe('ABCDE...VWXYZ');
    expect(result.length).toBe(13);
  });

  it('should throw error for invalid head ratio', () => {
    const text = 'Some log content that needs cropping';
    const separator = '...';
    expect(() => cropMiddle(text, 30, -0.1, separator)).toThrow(
      'headRatio must be between 0 and 1'
    );
    expect(() => cropMiddle(text, 30, 1.5, separator)).toThrow(
      'headRatio must be between 0 and 1'
    );
  });

  it('should throw error if maxLength too small for separator', () => {
    const text = 'Log entry that needs cropping';
    const longSeparator = '...[content omitted for brevity]...';
    expect(() => cropMiddle(text, 10, 0.5, longSeparator)).toThrow(
      'maxLength too small to accommodate separator'
    );
  });
});

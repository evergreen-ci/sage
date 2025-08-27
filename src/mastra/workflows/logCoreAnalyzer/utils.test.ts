import { normalizeLineEndings } from './utils';

describe('normalizeLineEndings', () => {
  it('should normalize line endings', async () => {
    const input = 'line1\r\nline2\r\n\r\n\r\n\r\nline3';
    const expected = 'line1\nline2\n\n\nline3';

    expect(normalizeLineEndings(input)).toBe(expected);
  });
});

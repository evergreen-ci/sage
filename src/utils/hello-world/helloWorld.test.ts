import { helloWorld } from '.';

describe('helloWorld', () => {
  it('should return "hello, world"', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = helloWorld();

    expect(result).toBe('hello, world');
    expect(consoleSpy).toHaveBeenCalledWith('hello, world');

    consoleSpy.mockRestore();
  });
});

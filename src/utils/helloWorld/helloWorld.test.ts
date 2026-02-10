import { helloWorld } from '.';

describe('helloWorld', () => {
  it('should print "hello, world" to the console', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    helloWorld();

    expect(consoleSpy).toHaveBeenCalledWith('hello, world');

    consoleSpy.mockRestore();
  });

  it('should return "hello, world"', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = helloWorld();

    expect(result).toBe('hello, world');

    vi.restoreAllMocks();
  });
});

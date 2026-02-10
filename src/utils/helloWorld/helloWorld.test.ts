import { helloWorld } from '.';

describe('helloWorld', () => {
  it('should print "hello, world"', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = helloWorld();

    expect(consoleSpy).toHaveBeenCalledWith('hello, world');
    expect(result).toBe('hello, world');

    consoleSpy.mockRestore();
  });
});

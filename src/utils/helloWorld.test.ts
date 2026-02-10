import { helloWorld } from './helloWorld';

describe('helloWorld', () => {
  it('should return "hello, world"', () => {
    const result = helloWorld();
    expect(result).toBe('hello, world');
  });

  it('should print "hello, world" to the console', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    helloWorld();

    expect(consoleSpy).toHaveBeenCalledWith('hello, world');
    consoleSpy.mockRestore();
  });
});

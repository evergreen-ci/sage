import { helloWorld } from './hello-world';

describe('helloWorld', () => {
  it('should return "hello, world"', () => {
    const result = helloWorld();
    expect(result).toBe('hello, world');
  });

  it('should log "hello, world" to console', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    helloWorld();

    expect(consoleSpy).toHaveBeenCalledWith('hello, world');
    consoleSpy.mockRestore();
  });
});

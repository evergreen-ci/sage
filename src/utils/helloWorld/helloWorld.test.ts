import { helloWorld } from '.';

describe('helloWorld', () => {
  it('should return "hello, world"', () => {
    expect(helloWorld()).toBe('hello, world');
  });

  it('should log "hello, world" to the console', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    helloWorld();
    expect(consoleSpy).toHaveBeenCalledWith('hello, world');
    consoleSpy.mockRestore();
  });
});

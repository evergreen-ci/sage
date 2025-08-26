import { vi } from 'vitest';

/**
 * Creates a mock logger instance with comprehensive logging methods
 * @returns An object containing mocked logger instances and methods
 * default - The default logger instance with mocked methods
 * logger - The main logger instance with mocked methods
 * loggerStream - A mocked logger stream with a write method
 */
export const createMockLogger = () => {
  const mockLoggerInstance = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    http: vi.fn(),
    debug: vi.fn(),
    audit: vi.fn(),
    security: vi.fn(),
    log: vi.fn(),
    child: vi.fn(() => mockLoggerInstance),
  };

  return {
    default: mockLoggerInstance,
    logger: mockLoggerInstance,
    loggerStream: {
      write: vi.fn(),
    },
  };
};

/**
 * Creates a mock configuration object with optional overrides
 * @param [options] - Partial configuration options to override defaults
 * @returns A mock configuration object
 * config - The configuration object with default and custom values
 */
export const createMockConfig = (options = {}) => ({
  config: {
    nodeEnv: 'test',
    ...options,
  },
});

/**
 * Creates a mock Mastra agent with a controllable generate method
 * @param [generateResponse] - The default response for the generate method
 * @param [generateResponse.text] - The generated text
 * @param [generateResponse.usage] - Usage statistics for the generation
 * @returns A mock Mastra agent with a generate method
 */
export const createMockMastraAgent = (
  generateResponse = {
    text: 'Sample generated response',
    usage: { tokens: 10 },
  }
) => ({
  mastra: {
    getAgent: vi.fn().mockReturnValue({
      generate: vi.fn().mockResolvedValue(generateResponse),
      getMemory: vi.fn().mockResolvedValue({
        getThreadById: vi.fn().mockResolvedValue({
          id: '123',
          resourceId: '123',
        }),
        createThread: vi.fn().mockResolvedValue({
          id: '123',
          resourceId: '123',
        }),
      }),
    }),
  },
});

/**
 * Sets up a comprehensive mock environment for testing
 * @returns An object containing mocks for logger, config, and Mastra
 * logger - A mocked logger instance
 * config - A mocked configuration object
 * mastra - A mocked Mastra agent
 */
export const setupTestMocks = () => ({
  logger: createMockLogger(),
  config: createMockConfig(),
  mastra: createMockMastraAgent(),
});

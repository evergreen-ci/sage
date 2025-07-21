import loggerInstance from './setup';
import { logger, loggerStream } from './index';

// Mock the winston logger instance
vi.mock('./setup', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
  },
}));

// Mock the config module
vi.mock('config', () => ({
  config: {
    nodeEnv: 'test',
    logging: {
      logLevel: 'debug',
      logToFile: false,
    },
  },
}));

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger.error', () => {
    it('should log error with Error object', () => {
      const message = 'Test error message';
      const error = new Error('Test error');
      const meta = { userId: '123', action: 'test' };

      logger.error(message, error, meta);

      expect(loggerInstance.error).toHaveBeenCalledWith(message, {
        error: 'Test error',
        stack: error.stack,
        userId: '123',
        action: 'test',
      });
    });

    it('should log error with unknown error', () => {
      const message = 'Test error message';
      const error = 'Unknown error string';
      const meta = { userId: '123' };

      logger.error(message, error, meta);

      expect(loggerInstance.error).toHaveBeenCalledWith(message, {
        error: 'Unknown error string',
        userId: '123',
      });
    });

    it('should log error without error object', () => {
      const message = 'Test error message';
      const meta = { userId: '123' };

      logger.error(message, undefined, meta);

      expect(loggerInstance.error).toHaveBeenCalledWith(message, {
        error: undefined,
        userId: '123',
      });
    });

    it('should log error without metadata', () => {
      const message = 'Test error message';
      const error = new Error('Test error');

      logger.error(message, error);

      expect(loggerInstance.error).toHaveBeenCalledWith(message, {
        error: 'Test error',
        stack: error.stack,
      });
    });
  });

  describe('logger.warn', () => {
    it('should log warning with metadata', () => {
      const message = 'Test warning message';
      const meta = { userId: '123', action: 'test' };

      logger.warn(message, meta);

      expect(loggerInstance.warn).toHaveBeenCalledWith(message, meta);
    });

    it('should log warning without metadata', () => {
      const message = 'Test warning message';

      logger.warn(message);

      expect(loggerInstance.warn).toHaveBeenCalledWith(message, undefined);
    });
  });

  describe('logger.info', () => {
    it('should log info with metadata', () => {
      const message = 'Test info message';
      const meta = { userId: '123', action: 'test' };

      logger.info(message, meta);

      expect(loggerInstance.info).toHaveBeenCalledWith(message, meta);
    });

    it('should log info without metadata', () => {
      const message = 'Test info message';

      logger.info(message);

      expect(loggerInstance.info).toHaveBeenCalledWith(message, undefined);
    });
  });

  describe('logger.debug', () => {
    it('should log debug with metadata', () => {
      const message = 'Test debug message';
      const meta = { userId: '123', action: 'test' };

      logger.debug(message, meta);

      expect(loggerInstance.debug).toHaveBeenCalledWith(message, meta);
    });

    it('should log debug without metadata', () => {
      const message = 'Test debug message';

      logger.debug(message);

      expect(loggerInstance.debug).toHaveBeenCalledWith(message, undefined);
    });
  });

  describe('logger.http', () => {
    it('should log http with metadata', () => {
      const message = 'Test http message';
      const meta = { method: 'GET', url: '/test', statusCode: 200 };

      logger.http(message, meta);

      expect(loggerInstance.http).toHaveBeenCalledWith(message, meta);
    });

    it('should log http without metadata', () => {
      const message = 'Test http message';

      logger.http(message);

      expect(loggerInstance.http).toHaveBeenCalledWith(message, undefined);
    });
  });

  describe('logger.audit', () => {
    it('should log audit event with all parameters', () => {
      const action = 'login';
      const resource = 'user';
      const userId = 'user123';
      const metadata = { ip: '192.168.1.1', userAgent: 'Mozilla' };

      // Mock Date.toISOString to return a predictable value
      const mockDate = new Date('2023-01-01T00:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      logger.audit(action, resource, userId, metadata);

      expect(loggerInstance.info).toHaveBeenCalledWith('AUDIT', {
        action: 'login',
        resource: 'user',
        userId: 'user123',
        timestamp: '2023-01-01T00:00:00.000Z',
        ip: '192.168.1.1',
        userAgent: 'Mozilla',
      });
    });

    it('should log audit event without userId and metadata', () => {
      const action = 'logout';
      const resource = 'session';

      const mockDate = new Date('2023-01-01T00:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      logger.audit(action, resource);

      expect(loggerInstance.info).toHaveBeenCalledWith('AUDIT', {
        action: 'logout',
        resource: 'session',
        userId: undefined,
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should log audit event with userId but no metadata', () => {
      const action = 'delete';
      const resource = 'document';
      const userId = 'admin123';

      const mockDate = new Date('2023-01-01T00:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      logger.audit(action, resource, userId);

      expect(loggerInstance.info).toHaveBeenCalledWith('AUDIT', {
        action: 'delete',
        resource: 'document',
        userId: 'admin123',
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });
  });

  describe('logger.security', () => {
    it('should log security event with all parameters', () => {
      const event = 'Failed login attempt';
      const severity = 'high' as const;
      const details = { ip: '192.168.1.1', attempts: 5 };

      const mockDate = new Date('2023-01-01T00:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      logger.security(event, severity, details);

      expect(loggerInstance.warn).toHaveBeenCalledWith('SECURITY', {
        event: 'Failed login attempt',
        severity: 'high',
        timestamp: '2023-01-01T00:00:00.000Z',
        ip: '192.168.1.1',
        attempts: 5,
      });
    });

    it('should log security event without details', () => {
      const event = 'Suspicious activity detected';
      const severity = 'medium' as const;

      const mockDate = new Date('2023-01-01T00:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      logger.security(event, severity);

      expect(loggerInstance.warn).toHaveBeenCalledWith('SECURITY', {
        event: 'Suspicious activity detected',
        severity: 'medium',
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should log security event with critical severity', () => {
      const event = 'Data breach detected';
      const severity = 'critical' as const;
      const details = { affectedUsers: 1000, dataType: 'personal' };

      const mockDate = new Date('2023-01-01T00:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      logger.security(event, severity, details);

      expect(loggerInstance.warn).toHaveBeenCalledWith('SECURITY', {
        event: 'Data breach detected',
        severity: 'critical',
        timestamp: '2023-01-01T00:00:00.000Z',
        affectedUsers: 1000,
        dataType: 'personal',
      });
    });
  });

  describe('loggerStream', () => {
    it('should write message to http logger', () => {
      const message = 'GET /api/users 200 50ms\n';

      loggerStream.write(message);

      expect(loggerInstance.http).toHaveBeenCalledWith(
        'GET /api/users 200 50ms'
      );
    });

    it('should trim whitespace from message', () => {
      const message = '  POST /api/login 401 100ms  \n';

      loggerStream.write(message);

      expect(loggerInstance.http).toHaveBeenCalledWith(
        'POST /api/login 401 100ms'
      );
    });

    it('should handle empty message', () => {
      const message = '';

      loggerStream.write(message);

      expect(loggerInstance.http).toHaveBeenCalledWith('');
    });
  });

  describe('Logger object structure', () => {
    it('should have all required methods', () => {
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('http');
      expect(logger).toHaveProperty('audit');
      expect(logger).toHaveProperty('security');
    });

    it('should have loggerStream with write method', () => {
      expect(loggerStream).toHaveProperty('write');
      expect(typeof loggerStream.write).toBe('function');
    });
  });
});

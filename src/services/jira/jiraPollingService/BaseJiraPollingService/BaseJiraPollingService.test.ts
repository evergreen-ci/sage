import { JiraClient } from '@/services/jira/jiraClient';
import { BaseJiraPollingService } from '.';

// Use vi.hoisted for mock functions that need setup/verification in tests
const { mockConnect, mockDisconnect, mockSearchIssues } = vi.hoisted(() => ({
  mockSearchIssues: vi.fn(),
  mockConnect: vi.fn(),
  mockDisconnect: vi.fn(),
}));

vi.mock('../jiraClient', () => ({
  JiraClient: vi.fn(),
}));

vi.mock('@/db/connection', () => ({
  db: {
    connect: mockConnect,
    disconnect: mockDisconnect,
  },
}));

describe('BaseJiraPollingService', () => {
  let mockJiraClient: JiraClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJiraClient = {
      searchIssues: mockSearchIssues,
    } as unknown as JiraClient;
  });

  describe('poll()', () => {
    it('executes JQL query and returns empty result when no tickets found', async () => {
      mockSearchIssues.mockResolvedValueOnce([]);

      const service = new BaseJiraPollingService({
        jiraClient: mockJiraClient,
        buildJqlQuery: () => 'test-jql-query',
        processTicket: async () => ({
          ticketKey: 'TEST-1',
          success: true,
        }),
      });

      const result = await service.poll();

      expect(mockSearchIssues).toHaveBeenCalledWith('test-jql-query');
      expect(result).toEqual({
        ticketsFound: 0,
        ticketsProcessed: 0,
        ticketsSkipped: 0,
        ticketsErrored: 0,
        results: [],
      });
    });

    it('processes tickets and aggregates results correctly', async () => {
      const mockIssues = [
        {
          key: 'TEST-1',
          fields: {
            summary: 'Test 1',
            description: 'Description 1',
            assignee: { emailAddress: 'user1@example.com' },
            labels: ['test-label'],
          },
        },
        {
          key: 'TEST-2',
          fields: {
            summary: 'Test 2',
            description: 'Description 2',
            assignee: { emailAddress: 'user2@example.com' },
            labels: ['test-label'],
          },
        },
      ];

      mockSearchIssues.mockResolvedValueOnce(mockIssues);

      const processTicketMock = vi
        .fn()
        .mockResolvedValueOnce({ ticketKey: 'TEST-1', success: true })
        .mockResolvedValueOnce({ ticketKey: 'TEST-2', success: true });

      const service = new BaseJiraPollingService({
        jiraClient: mockJiraClient,
        buildJqlQuery: () => 'test-jql-query',
        processTicket: processTicketMock,
      });

      const result = await service.poll();

      expect(result).toEqual({
        ticketsFound: 2,
        ticketsProcessed: 2,
        ticketsSkipped: 0,
        ticketsErrored: 0,
        results: [
          { ticketKey: 'TEST-1', success: true },
          { ticketKey: 'TEST-2', success: true },
        ],
      });
      expect(processTicketMock).toHaveBeenCalledTimes(2);
    });

    it('handles skipped tickets correctly', async () => {
      const mockIssues = [
        {
          key: 'TEST-1',
          fields: {
            summary: 'Test 1',
            description: null,
            assignee: null,
            labels: ['test-label'],
          },
        },
      ];

      mockSearchIssues.mockResolvedValueOnce(mockIssues);

      const service = new BaseJiraPollingService({
        jiraClient: mockJiraClient,
        buildJqlQuery: () => 'test-jql-query',
        processTicket: async () => ({
          ticketKey: 'TEST-1',
          success: true,
          skipped: true,
          skipReason: 'Test skip',
        }),
      });

      const result = await service.poll();

      expect(result).toEqual({
        ticketsFound: 1,
        ticketsProcessed: 0,
        ticketsSkipped: 1,
        ticketsErrored: 0,
        results: [
          {
            ticketKey: 'TEST-1',
            success: true,
            skipped: true,
            skipReason: 'Test skip',
          },
        ],
      });
    });

    it('handles errored tickets correctly and continues processing', async () => {
      const mockIssues = [
        {
          key: 'TEST-1',
          fields: {
            summary: 'Test 1',
            description: null,
            assignee: null,
            labels: ['test-label'],
          },
        },
        {
          key: 'TEST-2',
          fields: {
            summary: 'Test 2',
            description: 'Description 2',
            assignee: { emailAddress: 'user2@example.com' },
            labels: ['test-label'],
          },
        },
      ];

      mockSearchIssues.mockResolvedValueOnce(mockIssues);

      const processTicketMock = vi
        .fn()
        .mockResolvedValueOnce({
          ticketKey: 'TEST-1',
          success: false,
          error: 'Processing failed',
        })
        .mockResolvedValueOnce({ ticketKey: 'TEST-2', success: true });

      const service = new BaseJiraPollingService({
        jiraClient: mockJiraClient,
        buildJqlQuery: () => 'test-jql-query',
        processTicket: processTicketMock,
      });

      const result = await service.poll();

      expect(result).toEqual({
        ticketsFound: 2,
        ticketsProcessed: 1,
        ticketsSkipped: 0,
        ticketsErrored: 1,
        results: [
          {
            ticketKey: 'TEST-1',
            success: false,
            error: 'Processing failed',
          },
          { ticketKey: 'TEST-2', success: true },
        ],
      });
      expect(processTicketMock).toHaveBeenCalledTimes(2);
    });

    it('throws error when Jira API search fails', async () => {
      mockSearchIssues.mockRejectedValueOnce(new Error('Connection failed'));

      const service = new BaseJiraPollingService({
        jiraClient: mockJiraClient,
        buildJqlQuery: () => 'test-jql-query',
        processTicket: async () => ({
          ticketKey: 'TEST-1',
          success: true,
        }),
      });

      await expect(service.poll()).rejects.toThrow('Connection failed');
    });
  });

  describe('runAsJob()', () => {
    it('connects to database, runs polling, and disconnects', async () => {
      mockConnect.mockResolvedValueOnce(undefined);
      mockSearchIssues.mockResolvedValueOnce([]);
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new BaseJiraPollingService({
        jiraClient: mockJiraClient,
        buildJqlQuery: () => 'test-jql-query',
        processTicket: async () => ({
          ticketKey: 'TEST-1',
          success: true,
        }),
      });

      await service.runAsJob();

      expect(mockConnect).toHaveBeenCalled();
      expect(mockSearchIssues).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('disconnects even when polling fails', async () => {
      mockConnect.mockResolvedValueOnce(undefined);
      mockSearchIssues.mockRejectedValueOnce(new Error('Polling error'));
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new BaseJiraPollingService({
        jiraClient: mockJiraClient,
        buildJqlQuery: () => 'test-jql-query',
        processTicket: async () => ({
          ticketKey: 'TEST-1',
          success: true,
        }),
      });

      await expect(service.runAsJob()).rejects.toThrow('Polling error');

      expect(mockConnect).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('sets exit code to 1 when there are system errors', async () => {
      const mockIssues = [
        {
          key: 'TEST-ERR',
          fields: {
            summary: 'Error issue',
            description: null,
            assignee: null,
            labels: ['test-label'],
          },
        },
      ];

      mockConnect.mockResolvedValueOnce(undefined);
      mockSearchIssues.mockResolvedValueOnce(mockIssues);
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new BaseJiraPollingService({
        jiraClient: mockJiraClient,
        buildJqlQuery: () => 'test-jql-query',
        processTicket: async () => ({
          ticketKey: 'TEST-ERR',
          success: false,
          error: 'System failure',
        }),
      });

      // Save original exitCode
      const originalExitCode = process.exitCode;

      await service.runAsJob();

      expect(process.exitCode).toBe(1);
      expect(mockDisconnect).toHaveBeenCalled();

      // Restore original exitCode
      process.exitCode = originalExitCode;
    });

    it('does not set exit code for skipped tickets (validation failures)', async () => {
      const mockIssues = [
        {
          key: 'TEST-SKIP',
          fields: {
            summary: 'Skip issue',
            description: null,
            assignee: null,
            labels: ['test-label'],
          },
        },
      ];

      mockConnect.mockResolvedValueOnce(undefined);
      mockSearchIssues.mockResolvedValueOnce(mockIssues);
      mockDisconnect.mockResolvedValueOnce(undefined);

      const service = new BaseJiraPollingService({
        jiraClient: mockJiraClient,
        buildJqlQuery: () => 'test-jql-query',
        processTicket: async () => ({
          ticketKey: 'TEST-SKIP',
          success: true,
          skipped: true,
          skipReason: 'Validation failed',
        }),
      });

      // Save original exitCode
      const originalExitCode = process.exitCode;
      process.exitCode = undefined;

      await service.runAsJob();

      // Should not set exit code for validation failures (skipped tickets)
      expect(process.exitCode).toBeUndefined();
      expect(mockDisconnect).toHaveBeenCalled();

      // Restore original exitCode
      process.exitCode = originalExitCode;
    });
  });
});

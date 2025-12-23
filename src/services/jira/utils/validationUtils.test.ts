import type { ParsedTicketData } from '../types';
import {
  validateAssignee,
  validateCredentials,
  validateRepositoryLabel,
  validateTicket,
} from './validationUtils';

const { mockCredentialsExist } = vi.hoisted(() => ({
  mockCredentialsExist: vi.fn(),
}));

vi.mock('@/db/repositories/userCredentialsRepository', () => ({
  credentialsExist: mockCredentialsExist,
}));

describe('validationUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateRepositoryLabel', () => {
    it('returns error when repository is missing', () => {
      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: null,
        labels: [],
      };

      const error = validateRepositoryLabel(ticketData);
      expect(error).toContain('Missing repository label');
    });

    it('returns null when repository exists', () => {
      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/mongo-tools',
        labels: ['repo:mongodb/mongo-tools'],
      };

      const error = validateRepositoryLabel(ticketData);
      expect(error).toBeNull();
    });
  });

  describe('validateAssignee', () => {
    it('returns error when assignee is missing', () => {
      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: null,
        targetRepository: 'mongodb/mongo-tools',
        labels: [],
      };

      const error = validateAssignee(ticketData);
      expect(error).toContain('No assignee set');
    });

    it('returns null when assignee exists', () => {
      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/mongo-tools',
        labels: [],
      };

      const error = validateAssignee(ticketData);
      expect(error).toBeNull();
    });
  });

  describe('validateCredentials', () => {
    it('returns error when credentials do not exist', async () => {
      mockCredentialsExist.mockResolvedValueOnce(false);

      const error = await validateCredentials('user@example.com');
      expect(error).toContain('does not have credentials configured');
      expect(mockCredentialsExist).toHaveBeenCalledWith('user@example.com');
    });

    it('returns null when credentials exist', async () => {
      mockCredentialsExist.mockResolvedValueOnce(true);

      const error = await validateCredentials('user@example.com');
      expect(error).toBeNull();
    });
  });

  describe('validateTicket', () => {
    it('collects all validation errors', async () => {
      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: null,
        targetRepository: null,
        labels: [],
      };

      const result = await validateTicket(ticketData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Missing repository label');
      expect(result.errors[1]).toContain('No assignee set');
    });

    it('returns valid when all checks pass', async () => {
      mockCredentialsExist.mockResolvedValueOnce(true);

      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/mongo-tools',
        labels: ['repo:mongodb/mongo-tools'],
      };

      const result = await validateTicket(ticketData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('includes credentials error when assignee lacks credentials', async () => {
      mockCredentialsExist.mockResolvedValueOnce(false);

      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/mongo-tools',
        labels: ['repo:mongodb/mongo-tools'],
      };

      const result = await validateTicket(ticketData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain(
        'does not have credentials configured'
      );
    });
  });
});

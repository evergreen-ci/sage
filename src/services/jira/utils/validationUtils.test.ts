import type { ParsedTicketData } from '../types';
import {
  validateAssignee,
  validateCredentials,
  validateRepositoryLabel,
  validateTicket,
} from './validationUtils';

const { mockCredentialsExist, mockIsRepositoryConfigured } = vi.hoisted(() => ({
  mockCredentialsExist: vi.fn(),
  mockIsRepositoryConfigured: vi.fn(),
}));

vi.mock('@/db/repositories/userCredentialsRepository', () => ({
  credentialsExist: mockCredentialsExist,
}));

vi.mock('@/services/repositories', () => ({
  isRepositoryConfigured: mockIsRepositoryConfigured,
}));

describe('validationUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: repos are configured
    mockIsRepositoryConfigured.mockReturnValue(true);
  });

  describe('validateRepositoryLabel', () => {
    it('returns error when repository is missing', () => {
      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: null,
        targetRef: null,
        labels: [],
      };

      const error = validateRepositoryLabel(ticketData);
      expect(error).toContain('Missing repository label');
    });

    it('returns null when repository exists and is configured', () => {
      mockIsRepositoryConfigured.mockReturnValue(true);

      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/mongo-tools',
        targetRef: null,
        labels: ['repo:mongodb/mongo-tools'],
      };

      const error = validateRepositoryLabel(ticketData);
      expect(error).toBeNull();
      expect(mockIsRepositoryConfigured).toHaveBeenCalledWith(
        'mongodb/mongo-tools'
      );
    });

    it('returns error when repository is not configured and no inline ref', () => {
      mockIsRepositoryConfigured.mockReturnValue(false);

      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/unknown-repo',
        targetRef: null,
        labels: ['repo:mongodb/unknown-repo'],
      };

      const error = validateRepositoryLabel(ticketData);
      expect(error).toContain('is not configured');
      expect(error).toContain('specify a branch inline');
    });

    it('returns null when inline ref is provided even if repo not configured', () => {
      mockIsRepositoryConfigured.mockReturnValue(false);

      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/unknown-repo',
        targetRef: 'feature-branch',
        labels: ['repo:mongodb/unknown-repo@feature-branch'],
      };

      const error = validateRepositoryLabel(ticketData);
      expect(error).toBeNull();
      // Should not check config when inline ref is provided
      expect(mockIsRepositoryConfigured).not.toHaveBeenCalled();
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
        targetRef: null,
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
        targetRef: null,
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
        targetRef: null,
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
      mockIsRepositoryConfigured.mockReturnValue(true);

      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/mongo-tools',
        targetRef: null,
        labels: ['repo:mongodb/mongo-tools'],
      };

      const result = await validateTicket(ticketData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid when inline ref is provided', async () => {
      mockCredentialsExist.mockResolvedValueOnce(true);

      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/mongo-tools',
        targetRef: 'feature-branch',
        labels: ['repo:mongodb/mongo-tools@feature-branch'],
      };

      const result = await validateTicket(ticketData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('includes credentials error when assignee lacks credentials', async () => {
      mockCredentialsExist.mockResolvedValueOnce(false);
      mockIsRepositoryConfigured.mockReturnValue(true);

      const ticketData: ParsedTicketData = {
        ticketKey: 'TEST-1',
        summary: 'Test',
        description: null,
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/mongo-tools',
        targetRef: null,
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

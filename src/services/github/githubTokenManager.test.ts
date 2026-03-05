import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubTokenManager } from './githubTokenManager';
import { GitHubAppConfig } from './types';

const mockOctokit = {
  rest: {
    pulls: {
      get: vi.fn(),
    },
  },
};

vi.mock('octokit', () => ({
  Octokit: vi.fn(() => mockOctokit),
}));

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(),
}));

describe('GitHubTokenManager', () => {
  const mockConfig: GitHubAppConfig = {
    appId: '123456',
    privateKey: 'test-private-key',
    installationIds: {
      '10gen': '1001',
      'evergreen-ci': '1006',
    },
  };

  let tokenManager: GitHubTokenManager;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenManager = new GitHubTokenManager(mockConfig);
  });

  describe('getOctokit', () => {
    it('returns Octokit instance for valid organization', () => {
      const octokit = tokenManager.getOctokit('10gen');
      expect(octokit).toBeDefined();
    });

    it('throws error for invalid organization', () => {
      expect(() => tokenManager.getOctokit('invalid' as any)).toThrow(
        'No Octokit instance found for organization: invalid'
      );
    });
  });

  describe('getOctokitByRepo', () => {
    it('returns Octokit instance for valid repo format', () => {
      const octokit = tokenManager.getOctokitByRepo('10gen/mms');
      expect(octokit).toBeDefined();
    });

    it('throws error for unknown organization', () => {
      expect(() => tokenManager.getOctokitByRepo('unknown-org/repo')).toThrow(
        'No Octokit instance found for organization: unknown-org'
      );
    });
  });

  describe('getPullRequest', () => {
    it('fetches PR information successfully', async () => {
      const mockPrData = {
        number: 123,
        title: 'Test PR',
        state: 'closed',
        merged: true,
        merged_at: '2024-01-01T00:00:00Z',
        html_url: 'https://github.com/10gen/mms/pull/123',
      };

      mockOctokit.rest.pulls.get.mockResolvedValueOnce({ data: mockPrData });

      const result = await tokenManager.getPullRequest('10gen/mms', 123);

      expect(result).toEqual({
        number: 123,
        title: 'Test PR',
        state: 'closed',
        merged: true,
        mergedAt: '2024-01-01T00:00:00Z',
        url: 'https://github.com/10gen/mms/pull/123',
        repository: '10gen/mms',
      });

      expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
        owner: '10gen',
        repo: 'mms',
        pull_number: 123,
      });
    });

    it('throws error for invalid repo format', async () => {
      await expect(tokenManager.getPullRequest('invalid', 123)).rejects.toThrow(
        'Invalid repository format'
      );
    });
  });

  describe('getPullRequestByUrl', () => {
    it('parses GitHub PR URL and fetches PR', async () => {
      const mockPrData = {
        number: 456,
        title: 'Another PR',
        state: 'open',
        merged: false,
        merged_at: null,
        html_url: 'https://github.com/10gen/mms/pull/456',
      };

      mockOctokit.rest.pulls.get.mockResolvedValueOnce({ data: mockPrData });

      const result = await tokenManager.getPullRequestByUrl(
        'https://github.com/10gen/mms/pull/456'
      );

      expect(result!.number).toBe(456);
      expect(result!.repository).toBe('10gen/mms');
    });

    it('throws error for invalid PR URL', async () => {
      await expect(
        tokenManager.getPullRequestByUrl('https://invalid-url.com')
      ).rejects.toThrow('Invalid GitHub PR URL');
    });
  });

  describe('checkPullRequestMerged', () => {
    it('returns true for merged PR', async () => {
      const mockPrData = {
        number: 789,
        title: 'Merged PR',
        state: 'closed',
        merged: true,
        merged_at: '2024-01-01T00:00:00Z',
        html_url: 'https://github.com/10gen/mms/pull/789',
      };

      mockOctokit.rest.pulls.get.mockResolvedValueOnce({ data: mockPrData });

      const result = await tokenManager.checkPullRequestMerged(
        'https://github.com/10gen/mms/pull/789'
      );

      expect(result).toBe(true);
    });
  });
});


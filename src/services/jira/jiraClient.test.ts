// Use vi.hoisted for mock functions that need setup/verification in tests
// Import after mocks
import { jiraClient } from './jiraClient';

const {
  mockAddComment,
  mockEditIssue,
  mockGetIssue,
  mockSearchForIssuesUsingJqlEnhancedSearchPost,
} = vi.hoisted(() => ({
  mockSearchForIssuesUsingJqlEnhancedSearchPost: vi.fn(),
  mockEditIssue: vi.fn(),
  mockAddComment: vi.fn(),
  mockGetIssue: vi.fn(),
}));

vi.mock('jira.js', () => ({
  Version2Client: vi.fn().mockImplementation(() => ({
    issueSearch: {
      searchForIssuesUsingJqlEnhancedSearchPost:
        mockSearchForIssuesUsingJqlEnhancedSearchPost,
    },
    issues: { editIssue: mockEditIssue, getIssue: mockGetIssue },
    issueComments: { addComment: mockAddComment },
  })),
}));

describe('jiraClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchIssues', () => {
    it('searches issues using JQL', async () => {
      mockSearchForIssuesUsingJqlEnhancedSearchPost.mockResolvedValueOnce({
        issues: [
          {
            key: 'PROJ-123',
            fields: {
              summary: 'Test',
              description: 'Description',
              assignee: null,
              labels: ['sage-bot'],
            },
          },
        ],
      });

      const result = await jiraClient.searchIssues('project = PROJ');

      expect(
        mockSearchForIssuesUsingJqlEnhancedSearchPost
      ).toHaveBeenCalledWith({
        jql: 'project = PROJ',
        fields: ['summary', 'description', 'assignee', 'labels'],
        maxResults: 100,
      });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('PROJ-123');
    });

    it('uses custom fields when provided', async () => {
      mockSearchForIssuesUsingJqlEnhancedSearchPost.mockResolvedValueOnce({
        issues: [],
      });

      await jiraClient.searchIssues('project = PROJ', ['summary', 'status']);

      expect(
        mockSearchForIssuesUsingJqlEnhancedSearchPost
      ).toHaveBeenCalledWith({
        jql: 'project = PROJ',
        fields: ['summary', 'status'],
        maxResults: 100,
      });
    });

    it('returns empty array when no issues found', async () => {
      mockSearchForIssuesUsingJqlEnhancedSearchPost.mockResolvedValueOnce({
        issues: undefined,
      });

      const result = await jiraClient.searchIssues('project = PROJ');

      expect(result).toEqual([]);
    });
  });

  describe('removeLabel', () => {
    it('removes label from issue', async () => {
      mockEditIssue.mockResolvedValueOnce(undefined);

      await jiraClient.removeLabel('PROJ-123', 'sage-bot');

      expect(mockEditIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        update: {
          labels: [{ remove: 'sage-bot' }],
        },
      });
    });
  });

  describe('parseTargetRepositoryFromLabels', () => {
    it('extracts repo from labels', () => {
      const labels = ['sage-bot', 'repo:mongodb/mongo-tools', 'priority'];
      expect(jiraClient.parseTargetRepositoryFromLabels(labels)).toBe(
        'mongodb/mongo-tools'
      );
    });

    it('handles repo label only', () => {
      const labels = ['repo:org/repo-name'];
      expect(jiraClient.parseTargetRepositoryFromLabels(labels)).toBe(
        'org/repo-name'
      );
    });

    it('returns null for empty labels', () => {
      expect(jiraClient.parseTargetRepositoryFromLabels([])).toBeNull();
    });

    it('returns null when no repo label found', () => {
      expect(
        jiraClient.parseTargetRepositoryFromLabels(['sage-bot', 'bug'])
      ).toBeNull();
    });

    it('handles repos with dots and underscores', () => {
      expect(
        jiraClient.parseTargetRepositoryFromLabels(['repo:my_org/my.repo-name'])
      ).toBe('my_org/my.repo-name');
    });
  });

  describe('extractTicketData', () => {
    it('extracts all fields from issue', () => {
      const issue = {
        key: 'PROJ-123',
        fields: {
          summary: 'Test summary',
          description: 'Description text',
          assignee: { emailAddress: 'user@example.com', displayName: 'User' },
          labels: ['sage-bot', 'repo:mongodb/test'],
        },
      };

      const result = jiraClient.extractTicketData(issue);

      expect(result).toEqual({
        ticketKey: 'PROJ-123',
        summary: 'Test summary',
        description: 'Description text',
        assigneeEmail: 'user@example.com',
        targetRepository: 'mongodb/test',
        labels: ['sage-bot', 'repo:mongodb/test'],
      });
    });

    it('handles missing assignee', () => {
      const issue = {
        key: 'PROJ-456',
        fields: {
          summary: 'No assignee',
          description: null,
          assignee: null,
          labels: [],
        },
      };

      const result = jiraClient.extractTicketData(issue);

      expect(result.assigneeEmail).toBeNull();
      expect(result.targetRepository).toBeNull();
      expect(result.labels).toEqual([]);
    });
  });

  describe('addComment', () => {
    it('adds comment to issue using correct API call', async () => {
      mockAddComment.mockResolvedValueOnce(undefined);

      await jiraClient.addComment('PROJ-123', 'This is a test comment');

      expect(mockAddComment).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        comment: 'This is a test comment',
      });
    });
  });

  describe('findLabelAddedBy', () => {
    it('returns email when label was added in changelog', async () => {
      mockGetIssue.mockResolvedValueOnce({
        changelog: {
          histories: [
            {
              author: { emailAddress: 'adder@example.com' },
              items: [
                {
                  field: 'labels',
                  from: 'existing-label',
                  to: 'existing-label sage-bot',
                },
              ],
            },
          ],
        },
      });

      const result = await jiraClient.findLabelAddedBy('PROJ-123', 'sage-bot');

      expect(result).toBe('adder@example.com');
      expect(mockGetIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'PROJ-123',
        expand: 'changelog',
        fields: [],
      });
    });

    it('ignores non-label field changes in changelog', async () => {
      mockGetIssue.mockResolvedValueOnce({
        changelog: {
          histories: [
            {
              author: { emailAddress: 'user@example.com' },
              items: [
                {
                  field: 'status',
                  from: 'Open',
                  to: 'In Progress',
                },
                {
                  field: 'priority',
                  from: 'Low',
                  to: 'High',
                },
              ],
            },
          ],
        },
      });

      const result = await jiraClient.findLabelAddedBy('PROJ-123', 'sage-bot');

      expect(result).toBeNull();
    });

    it('finds label added in earlier history entry', async () => {
      mockGetIssue.mockResolvedValueOnce({
        changelog: {
          histories: [
            {
              author: { emailAddress: 'recent@example.com' },
              items: [
                {
                  field: 'status',
                  from: 'Open',
                  to: 'Closed',
                },
              ],
            },
            {
              author: { emailAddress: 'label-adder@example.com' },
              items: [
                {
                  field: 'labels',
                  from: '',
                  to: 'sage-bot',
                },
              ],
            },
          ],
        },
      });

      const result = await jiraClient.findLabelAddedBy('PROJ-123', 'sage-bot');

      expect(result).toBe('label-adder@example.com');
    });
  });
});
